import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { cacheGet } from '../config/redis';

// Support JWKS verification when SUPABASE_JWKS_URL is provided
// Use a runtime require to avoid adding types dependency for `jwks-rsa`.
let jwksGetKey: any = null;
if (process.env.SUPABASE_JWKS_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jwksRsa = require('jwks-rsa');
    const client = jwksRsa({
      jwksUri: process.env.SUPABASE_JWKS_URL,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 60,
    });
    jwksGetKey = (header: any, cb: any) => {
      if (!header || !header.kid) return cb(new Error('No KID in token header'));
      client.getSigningKey(header.kid, (err: any, key: any) => {
        if (err) return cb(err);
        const signingKey = key.getPublicKey ? key.getPublicKey() : key.rsaPublicKey;
        cb(null, signingKey);
      });
    };
  } catch (e) {
    logger.warn('jwks-rsa not available; falling back to shared secret');
    jwksGetKey = null;
  }
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        role: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const jwtSecret = process.env.JWT_SECRET;
  const placeholderSecrets = ['your-64-byte-hex-secret-here', 'changeme', 'replace-me'];

  // Allow operation without an HMAC `JWT_SECRET` only when JWKS is configured
  // and `ALLOW_JWKS_ONLY=true` is explicitly set. This avoids accidental
  // enabling JWKS-only mode in test or dev environments.
  const allowJwksOnly = process.env.ALLOW_JWKS_ONLY === 'true';
  if ((!jwtSecret || placeholderSecrets.includes(jwtSecret.toLowerCase())) && !(jwksGetKey && allowJwksOnly)) {
    logger.error('JWT secret is not configured and no JWKS available');
    res.status(500).json({ error: 'Server authentication misconfiguration' });
    return;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn({ path: req.path }, 'Missing bearer token');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const token = authHeader.slice(7);

  // Check if token has been blacklisted (logout)
  const blacklisted = await cacheGet('token:blacklist:' + token);
  if (blacklisted) {
    res.status(401).json({ error: 'Token has been revoked' });
    return;
  }

    // Prefer HMAC secret verification when available; only use JWKS when
    // the token header indicates an RSA algorithm (e.g. RS256) and a JWKS
    // client is configured.
    const decoded = jwt.decode(token, { complete: true }) as any;
    const alg = decoded?.header?.alg as string | undefined;
    const useJwks = !!jwksGetKey && typeof alg === 'string' && alg.toUpperCase().startsWith('RS');

    const payload: any = await new Promise((resolve, reject) => {
      if (useJwks) {
        jwt.verify(token, jwksGetKey, { algorithms: ['RS256'] }, (err, p) => (err ? reject(err) : resolve(p)));
      } else {
        try {
          const p = jwt.verify(token, jwtSecret as string);
          resolve(p);
        } catch (e) {
          reject(e);
        }
      }
    });

    // Populate user info from DB to ensure role is authoritative
    const sub = payload?.sub;
    if (!sub) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    const dbUser = await prisma.user.findUnique({ where: { id: sub } as any });
    const role = dbUser?.role ?? payload.role ?? 'CASUAL';

    req.user = { sub, role };
    next();
  } catch (err) {
    logger.warn({ err, path: req.path }, 'Invalid or expired token');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role-based access
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}