import { Request, Response, NextFunction } from 'express';
import { captureError } from '../config/monitoring';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
    // Single structured log + Sentry capture. Note the request-counting
  // middleware in app.ts already increments `errors_total` for any 5xx via
  // res.on('finish'), so we must NOT call recordError() here or 5xx errors
  // would be double-counted in the metrics.
  captureError(err, { path: req.path, method: req.method });

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const code = (err as any).code;
    if (code === 'P2002') {
      res.status(409).json({ error: 'Resource already exists' });
      return;
    }
    if (code === 'P2025') {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }
  }

  // Don't leak stack traces in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { stack: err.stack, message: err.message })
  });
}