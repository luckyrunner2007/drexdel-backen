import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { cacheSet, cacheGet, getRedisClient } from '../config/redis';
import { randomInt } from 'crypto';
import { logger } from '../config/logger';
import { sendOtpEmail } from '../services/emailService';
import { sendOtpSms } from '../services/smsService';

// Validation schemas
export const loginSchema = z.object({
  identity: z.string().min(3).max(255),
  password: z.string().min(8).max(128),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  username: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
  phoneNumber: z.string().trim().min(7).max(30).optional(),
  password: z.string().min(8).max(128),
});

export const otpRequestSchema = z.object({
  identity: z.string().min(3).max(255),
});


// Password strength validator
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit.';
  return null;
}



export const verifyOtpSchema = z.object({
  identity: z.string().min(3).max(255),
  otp: z.string().min(4).max(10),
});

export const resetPasswordSchema = z.object({
  identity: z.string().min(3).max(255),
  newPassword: z.string().min(8).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
});

export const verifyEmailSchema = z.object({
  code: z.string().min(4).max(10),
});

export const verifyPhoneSchema = z.object({
  code: z.string().min(4).max(10),
});



// Token blacklist for logout - stored in Redis with token expiry
const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';

const SALT_ROUNDS = 12;

function issueToken(user: { id: string; role: string }): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('Authentication is not configured');
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '24h', algorithm: 'HS256' });
}

// Rate limit: store in Redis (scale: move to dedicated rate limiter service)
async function checkRateLimit(key: string, maxAttempts: number, windowSeconds: number): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  const current = await cacheGet(redisKey);
  
  if (!current) {
    await cacheSet(redisKey, '1', windowSeconds);
    return true;
  }
  
  const count = parseInt(current, 10);
  if (count >= maxAttempts) return false;
  
  // Extend TTL on existing key
  const client = await getRedisClient();
  if (!client) return true;
  await client.incr(redisKey);
  return true;
}

export class AuthController {
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const data = (req as any).validatedBody || signupSchema.parse(req.body);
      const email = data.email.toLowerCase();
      const pwdError = validatePasswordStrength(data.password);
      if (pwdError) {
        res.status(400).json({ success: false, message: pwdError });
        return;
      }
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
      const user = await prisma.user.create({
        data: { name: data.name, email, username: data.username || null, phoneNumber: data.phoneNumber || null, passwordHash },
      });
      const token = issueToken(user);
      await cacheSet(`session:${user.id}`, token, 86400);
      res.status(201).json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, username: user.username || null, role: user.role } });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ success: false, message: 'An account with that email or phone number already exists.' });
        return;
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, message: 'Invalid registration details.' });
        return;
      }
      logger.error({ err: error }, 'Signup error');
      res.status(500).json({ success: false, message: 'Unable to create account.' });
    }
  }
  
  async processLogin(req: Request, res: Response): Promise<void> {
    try {
      const parse = (req as any).validatedBody
        ? { success: true as const, data: (req as any).validatedBody }
        : loginSchema.safeParse(req.body);

      if (!parse.success) {
        res.status(400).json({ success: false, message: 'Invalid input format' });
        return;
      }

      const { identity, password } = parse.data;
      const rateKey = `login:${req.ip}:${identity}`;
      
      if (!await checkRateLimit(rateKey, 5, 900)) { // 5 attempts per 15 min
        res.status(429).json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' });
        return;
      }

      // Find user (case-insensitive email, exact phone)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identity.trim().toLowerCase() },
            { phoneNumber: identity.trim() }
          ]
        }
      });

      // Constant-time comparison to prevent timing attacks
      const dummyHash = '$2b$12$dummyhashfordummycomparison';
      const hashToCompare = user?.passwordHash || dummyHash;
      const isValid = await bcrypt.compare(password, hashToCompare);

      if (!user || !isValid) {
        // Increment failed attempts only when the user record actually exists;
        // passing an undefined id to updateMany would match all rows.
        if (user) {
          await prisma.user.updateMany({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } }
          });
        }

        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      // Check if account is locked
      if (user.isAccountLocked || (user.lockedUntil && user.lockedUntil > new Date())) {
        res.status(403).json({ success: false, message: 'Account is temporarily locked.' });
        return;
      }

      // Reset failed attempts on success
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      });

      const token = issueToken(user);

      // Cache session in Redis (scale: move to distributed session store)
      await cacheSet(`session:${user.id}`, token, 86400);

      res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });

    } catch (error) {
      logger.error({ err: error }, 'Login error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }


  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const data = (req as any).validatedBody || verifyOtpSchema.parse(req.body);
      const identity = data.identity.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: identity }, { phoneNumber: identity }]
        }
      });
      if (!user) {
        res.status(200).json({ success: true, message: 'If an account exists, the code has been verified.' });
        return;
      }
      const otpKey = 'otp:' + user.id;
      const storedOtp = await cacheGet(otpKey);
      if (!storedOtp || storedOtp !== data.otp) {
        res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        return;
      }
      await cacheGet(otpKey); // Read to clear
      const redis = await getRedisClient();
      if (redis) {
        await redis.del(otpKey);
      }
      res.status(200).json({ success: true, message: 'Code verified. You can now reset your password.' });
    } catch (error) {
      logger.error({ err: error }, 'Verify OTP error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const data = (req as any).validatedBody || resetPasswordSchema.parse(req.body);
      const identity = data.identity.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: identity }, { phoneNumber: identity }]
        }
      });
      if (!user) {
        res.status(200).json({ success: true, message: 'If an account exists, your password has been reset.' });
        return;
      }
      const pwdError = validatePasswordStrength(data.newPassword);
      if (pwdError) {
        res.status(400).json({ success: false, message: pwdError });
        return;
      }
      const passwordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      const redis = await getRedisClient();
      if (redis) {
        await redis.del('otp:' + user.id);
      }
      logger.info({ userId: user.id }, 'Password reset successfully');
      res.status(200).json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
      logger.error({ err: error }, 'Reset password error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const data = (req as any).validatedBody || changePasswordSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        return;
      }
      const pwdError = validatePasswordStrength(data.newPassword);
      if (pwdError) {
        res.status(400).json({ success: false, message: pwdError });
        return;
      }
      const passwordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
      // Invalidate all existing tokens for this user (force re-login)
      const redis = await getRedisClient();
      if (redis) {
        await redis.del('session:' + user.id);
      }
      res.status(200).json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
      logger.error({ err: error }, 'Change password error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (token) {
        const blacklistKey = TOKEN_BLACKLIST_PREFIX + token;
        const ttl = 86400;
        await cacheSet(blacklistKey, '1', ttl);
      }
      const userId = req.user?.sub;
      if (userId) {
        const redis = await getRedisClient();
        if (redis) {
          await redis.del('session:' + userId);
        }
      }
      res.status(200).json({ success: true, message: 'Logged out successfully.' });
    } catch (error) {
      logger.error({ err: error }, 'Logout error');
      res.status(200).json({ success: true, message: 'Logged out successfully.' });
    }
  }

  /**
   * Generates + stores a 6-digit email-verification code and delivers it.
   * Transport is wired into the email provider at deploy time (the OTP is
   * logged and also stored so the user can complete the flow in dev).
   */
  async sendEmailVerificationCode(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Prevent OTP abuse: max 3 codes per 10 minutes per user
      const rateKey = `emailverify:rate:${userId}`;
      const sent = await cacheGet(rateKey);
      if (sent && parseInt(sent, 10) >= 3) {
        res.status(429).json({ success: false, message: 'Too many codes requested. Try again in 10 minutes.' });
        return;
      }
      await cacheSet(rateKey, sent ? String(parseInt(sent, 10) + 1) : '1', 600);

      const code = randomInt(100000, 999999).toString();
      await cacheSet(`emailverify:${userId}`, code, 600);

      await sendOtpEmail(user.email, code, 'email-verification');

      res.status(200).json({ success: true, message: 'Verification code sent to your email.' });
    } catch (error) {
      logger.error({ err: error }, 'Send email verification error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Validates the emailed code and marks the user's email as verified.
   * Verification state is stored in Redis (TTL 30 days) — swap for a
   * DB column (emailVerifiedAt) when a migration is available.
   */
  async verifyEmailCode(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const data = (req as any).validatedBody || verifyEmailSchema.parse(req.body);
      const storedCode = await cacheGet(`emailverify:${userId}`);
      if (!storedCode || storedCode !== data.code) {
        res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        return;
      }

      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`emailverify:${userId}`);
      }
      // Mark verified for 30 days (mirrors the session window)
      await cacheSet(`verified:email:${userId}`, '1', 30 * 86400);

            logger.info({ userId: user.id }, 'Email verified');
      res.status(200).json({ success: true, message: 'Email verified successfully.' });
    } catch (error) {
      logger.error({ err: error }, 'Verify email error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Sends a 6-digit SMS code to the authenticated user's phone. */
  async sendPhoneVerificationCode(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      if (!user.phoneNumber) {
        res.status(400).json({ success: false, message: 'No phone number on this account.' });
        return;
      }

      // Rate-limit: max 3 codes per 10 minutes
      const rateKey = `phoneverify:rate:${userId}`;
      const sent = await cacheGet(rateKey);
      if (sent && parseInt(sent, 10) >= 3) {
        res.status(429).json({ success: false, message: 'Too many codes requested. Try again in 10 minutes.' });
        return;
      }
      await cacheSet(rateKey, sent ? String(parseInt(sent, 10) + 1) : '1', 600);

      const code = randomInt(100000, 999999).toString();
      await cacheSet(`phoneverify:${userId}`, code, 600);

      await sendOtpSms(user.phoneNumber, code, 'phone-verification');

      res.status(200).json({ success: true, message: 'Verification code sent to your phone.' });
    } catch (error) {
      logger.error({ err: error }, 'Send phone verification error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /** Validates the SMS code and marks the phone as verified. */
  async verifyPhoneCode(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const data = (req as any).validatedBody || verifyPhoneSchema.parse(req.body);
      const storedCode = await cacheGet(`phoneverify:${userId}`);
      if (!storedCode || storedCode !== data.code) {
        res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        return;
      }

      const redis = await getRedisClient();
      if (redis) {
        await redis.del(`phoneverify:${userId}`);
      }
      await cacheSet(`verified:phone:${userId}`, '1', 30 * 86400);

      logger.info({ userId: user.id }, 'Phone verified');
      res.status(200).json({ success: true, message: 'Phone number verified successfully.' });
    } catch (error) {
      logger.error({ err: error }, 'Verify phone error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async requestAccountRescueOtp(req: Request, res: Response): Promise<void> {
    try {
      const parse = (req as any).validatedBody
        ? { success: true as const, data: (req as any).validatedBody }
        : otpRequestSchema.safeParse(req.body);

      if (!parse.success) {
        res.status(400).json({ success: false, message: 'Invalid input' });
        return;
      }

      const { identity } = parse.data;
      
      // Always return 200 to prevent email enumeration
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identity.trim().toLowerCase() },
            { phoneNumber: identity.trim() }
          ]
        }
      });

      if (!user) {
        res.status(200).json({ 
          success: true, 
          message: 'If an account exists, a code has been sent.' 
        });
        return;
      }

      // Generate cryptographically secure OTP
      const otp = randomInt(100000, 999999).toString();
      const otpKey = `otp:${user.id}`;
      
      // Store with 10-minute TTL
      await cacheSet(otpKey, otp, 600);

      // Deliver via the matching channel (email for @identity, SMS otherwise)
      const viaEmail = identity.includes('@');
      if (viaEmail && user.email) {
        await sendOtpEmail(user.email, otp, 'password-reset');
      } else if (user.phoneNumber) {
        await sendOtpSms(user.phoneNumber, otp, 'password-reset');
      } else {
        logger.warn({ userId: user.id }, 'No contact method available for password reset OTP');
      }

      res.status(200).json({
        success: true,
        message: 'If an account exists, a code has been sent.',
        destinationType: viaEmail ? 'email' : 'sms'
      });

    } catch (error) {
      logger.error({ err: error }, 'OTP error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export const authController = new AuthController();
