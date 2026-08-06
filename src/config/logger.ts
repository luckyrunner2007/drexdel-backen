import pino from 'pino';

const transport = process.env.NODE_ENV === 'development'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    }
  : undefined;

// Redact sensitive values from structured log payloads so secrets, tokens,
// passwords and card data never reach log sinks in production. Pino replaces
// matched paths with the string "[Redacted]".
const redactPaths = [
  // Credentials & secrets
  '*.password',
  '*.passwordHash',
  '*.secret',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.authorization',
  '*.apiKey',
  '*.clientSecret',
  // Payment / PII
  '*.cardNumber',
  '*.cvc',
  '*.cvv',
  '*.clientSecret',
  '*.publishableKey',
  '*.secretKey',
  '*.webhookSecret',
  '*.cryptographicToken',
  '*.qrCodeString',
  // Request headers that commonly carry secrets
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  // Nested error properties
  'err.config.headers.authorization',
  'err.config.headers.Authorization',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: redactPaths,
    censor: '[Redacted]',
  },
  transport,
});
