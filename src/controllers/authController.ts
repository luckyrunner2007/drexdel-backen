import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { cacheSet, cacheGet, getRedisClient } from '../config/redis';
import { randomInt } from 'crypto';
import { logger } from '../config/logger';

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
        // Increment failed attempts
        await prisma.user.updateMany({
          where: { id: user?.id },
          data: { failedLoginAttempts: { increment: 1 } }
        });
        
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

      // Scale: integrate Twilio/SNS here
      logger.info({ userId: user.id, destination: user.phoneNumber || user.email }, 'OTP generated');

      res.status(200).json({
        success: true,
        message: 'If an account exists, a code has been sent.',
        destinationType: identity.includes('@') ? 'email' : 'sms'
      });

    } catch (error) {
      logger.error({ err: error }, 'OTP error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export const authController = new AuthController();
