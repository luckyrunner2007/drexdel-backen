import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes('your-') || value.includes('changeme') || value.includes('replace-me')) {
    throw new Error(`Missing or placeholder environment variable: ${name}`);
  }
  return value;
}

export const BACKEND_HOST = process.env.BACKEND_HOST || '0.0.0.0';
export const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '5050', 10);
export const DATABASE_URL = requireEnv('DATABASE_URL');
export const REDIS_URL = process.env.REDIS_URL || '';
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
export const REDIS_TLS = process.env.REDIS_TLS === 'true';
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
export const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
export const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';
export const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'stripe';
export const MTN_MOMO_CONSUMER_KEY = process.env.MTN_MOMO_CONSUMER_KEY || '';
export const MTN_MOMO_CONSUMER_SECRET = process.env.MTN_MOMO_CONSUMER_SECRET || '';
export const MTN_MOMO_SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY || '';
export const MTN_MOMO_API_USER = process.env.MTN_MOMO_API_USER || '';
export const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY || '';
export const MTN_MOMO_ENVIRONMENT = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
// Telecom webhook signature verification. When set, callbacks to
// /v1/payments/telecom-webhook must include a valid HMAC-SHA256 signature
// in the `X-Webhook-Signature` header computed over the raw request body.
export const TELECOM_WEBHOOK_SECRET = process.env.TELECOM_WEBHOOK_SECRET || '';
export const SENTRY_DSN = process.env.SENTRY_DSN || '';

export function validateRuntimeEnv(): void {
  requireEnv('JWT_SECRET');
}
