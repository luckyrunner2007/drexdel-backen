import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

/**
 * PROJECT DREXDEL - CLIENT-SIDE ERROR REPORTING CONTROLLER
 * FILE: src/controllers/errorReportController.ts
 *
 * The React Native RootErrorBoundary reports hard JS crashes (render errors
 * caught by an error boundary) here so the dev team can triage without a
 * crash-report SDK. Each report stores only the crash message/stack +
 * device context; no arbitrary user content is persisted.
 */

const MESSAGE_MAX = 4000;
const STACK_MAX = 8000;
const COMPONENT_STACK_MAX = 8000;
const DEVICE_INFO_MAX_BYTES = 4000;

export const reportErrorSchema = z.object({
  message: z.string().min(1).max(MESSAGE_MAX),
  stack: z.string().max(STACK_MAX).optional(),
  componentStack: z.string().max(COMPONENT_STACK_MAX).optional(),
  platform: z.string().max(64).optional(),
  appVersion: z.string().max(64).optional(),
  deviceInfo: z.record(z.string(), z.any()).optional(),
  url: z.string().url().optional(),
  userAgent: z.string().max(512).optional(),
});

export const listErrorReportsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  platform: z.string().max(64).optional(),
});

function truncate(value: string | undefined, max: number): string | null {
  if (!value) return null;
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '\u2026';
}

function sanitizeDeviceInfo(info: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!info) return undefined;
  const json = JSON.stringify(info);
  if (json.length > DEVICE_INFO_MAX_BYTES) {
    return { truncated: true, length: json.length };
  }
  return info;
}

export class ErrorReportController {
  /** POST /v1/errors/report - persist a client-side error-boundary crash. */
  async report(req: Request, res: Response): Promise<void> {
    try {
      const data = (req as any).validatedBody ?? reportErrorSchema.parse(req.body);
      const userId = req.user?.sub ?? null;

      const report = await prisma.errorReport.create({
        data: {
          userId,
          message: truncate(data.message, MESSAGE_MAX)!,
          stack: truncate(data.stack, STACK_MAX),
          componentStack: truncate(data.componentStack, COMPONENT_STACK_MAX),
          platform: data.platform,
          appVersion: data.appVersion,
          deviceInfo: sanitizeDeviceInfo(data.deviceInfo),
          url: data.url,
          userAgent: data.userAgent ?? (req.get('User-Agent') ?? null),
        },
      });

      logger.warn({ errorId: report.id, userId, platform: data.platform, path: req.path }, 'Client error report received');
      res.status(201).json({ success: true, errorId: report.id });
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: err.flatten?.().fieldErrors ?? {} });
        return;
      }
      logger.error({ err, path: req.path }, 'Failed to store client error report');
      res.status(500).json({ error: 'Failed to record error report' });
    }
  }

  /** GET /v1/errors/reports - list recent reports (admin/dev only). */
  async listReports(req: Request, res: Response): Promise<void> {
    try {
      const data = (req as any).validatedQuery ?? listErrorReportsSchema.parse(req.query);
      const where: Record<string, any> = {};
      if (data.platform) where.platform = data.platform;

      const reports = await prisma.errorReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: data.limit,
        select: {
          id: true,
          userId: true,
          platform: true,
          appVersion: true,
          message: true,
          createdAt: true,
        },
      });

      res.status(200).json({ success: true, reports });
    } catch (err: any) {
      logger.error({ err, path: req.path }, 'Failed to list error reports');
      res.status(500).json({ error: 'Failed to list error reports' });
    }
  }
}

export const errorReportController = new ErrorReportController();