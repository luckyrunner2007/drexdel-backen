/**
 * PROJECT DREXDEL - ERROR MONITORING + APPLICATION METRICS
 *
 * Error monitoring uses Sentry when `SENTRY_DSN` is configured and gracefully
 * degrades to structured logging otherwise, so local dev and CI never need an
 * external service. Metrics are lightweight in-process counters suitable for a
 * single instance; for multi-instance deployments expose them via a scraper
 * (e.g. Prometheus) instead.
 */

import { logger } from './logger';

// Lazy Sentry loader — avoids a hard dependency and keeps the no-op path
// working when Sentry isn't configured.
let sentryCaptureException: ((err: Error) => void) | null = null;
let monitoringInitialized = false;

export function initMonitoring(): void {
  if (monitoringInitialized) return;
  monitoringInitialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Error monitoring disabled (SENTRY_DSN not set); using structured logging fallback');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      // Scrub sensitive data before it leaves the process.
      beforeSend(event: any) {
        if (event.request) {
          delete event.request.headers?.authorization;
          delete event.request.headers?.Authorization;
          delete event.request.cookies;
          if (event.request.data && typeof event.request.data === 'object') {
            event.request.data = redactObject(event.request.data);
          }
        }
        return event;
      },
    });
    sentryCaptureException = (err: Error) => Sentry.captureException(err);
    logger.info('Error monitoring enabled via Sentry');
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'Sentry SDK not available; falling back to structured logging');
  }
}

/**
 * Capture an error for monitoring. Always logs it structurally; additionally
 * reports to Sentry when configured.
 */
export function captureError(err: Error, context?: Record<string, unknown>): void {
  logger.error({ err, ...context }, err.message || 'Unhandled error');

  if (sentryCaptureException) {
    try {
      if (context && Object.keys(context).length) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Sentry = require('@sentry/node');
        Sentry.withScope((scope: any) => {
          for (const [key, value] of Object.entries(context)) {
            scope.setExtra(key, value);
          }
          Sentry.captureException(err);
        });
      } else {
        sentryCaptureException(err);
      }
    } catch {
      // Monitoring must never crash the request path.
    }
  }
}

// ---------------------------------------------------------------------------
// Lightweight in-process metrics
// ---------------------------------------------------------------------------

interface Metrics {
  requestsTotal: number;
  requestsByStatus: Record<string, number>;
  errorsTotal: number;
  startTimeMs: number;
}

const metrics: Metrics = {
  requestsTotal: 0,
  requestsByStatus: {},
  errorsTotal: 0,
  startTimeMs: Date.now(),
};

/** Increment request counters. Call from the metrics middleware on every response. */
export function recordRequest(statusCode: number): void {
  metrics.requestsTotal++;
  const bucket = `${Math.floor(statusCode / 100)}xx`;
  metrics.requestsByStatus[bucket] = (metrics.requestsByStatus[bucket] || 0) + 1;
  if (statusCode >= 500) metrics.errorsTotal++;
}

/* * Increment the error counter for non-HTTP failures (e.g. queue/job errors).
 * HTTP 5xx responses are already counted by recordRequest, so this must NOT
 * be called alongside a response or 5xx errors would be double-counted. */
export function recordError(): void {
  metrics.errorsTotal++;
}

/** Serialise current metrics for the `/metrics` endpoint. */
export function getMetrics(): Record<string, unknown> {
  const mem = process.memoryUsage();
  return {
    process: {
      pid: process.pid,
      uptime_seconds: Math.round(process.uptime()),
      started_at: new Date(metrics.startTimeMs).toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
    memory: {
      rss_bytes: mem.rss,
      heap_used_bytes: mem.heapUsed,
      heap_total_bytes: mem.heapTotal,
      external_bytes: mem.external,
    },
    requests: {
      total: metrics.requestsTotal,
      by_status: { ...metrics.requestsByStatus },
      errors_total: metrics.errorsTotal,
    },
  };
}

// Redact well-known sensitive keys from an object before it is attached to a
// Sentry event's request data.
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'secret', 'token', 'authorization',
  'clientSecret', 'cardNumber', 'cvc', 'cvv', 'cryptographicToken',
]);

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = '[Redacted]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactObject(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
