/**
 * PROJECT DREXDEL - CLIENT-SIDE ERROR REPORTING API
 * FILE: src/services/api/errorApi.ts
 *
 * Thin wrapper around the shared DrexdelApiClient that the RootErrorBoundary
 * uses to ship JS render crashes to POST /v1/errors/report for dev triage.
 */
import { drexdelApiClient, ApiResponse } from './client';

export interface ClientErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  platform?: string;
  appVersion?: string;
  deviceInfo?: Record<string, any>;
  url?: string;
}

class ErrorApi {
  /** Fire-and-forget crash report from the global error boundary. */
  public async reportError(report: ClientErrorReport): Promise<ApiResponse<{ errorId: string }>> {
    return drexdelApiClient.post<{ errorId: string }>('/errors/report', {
      message: report.message,
      stack: report.stack,
      componentStack: report.componentStack,
      platform: report.platform,
      appVersion: report.appVersion,
      deviceInfo: report.deviceInfo,
      url: report.url,
    });
  }
}

export const errorApi = new ErrorApi();
