/**
 * PROJECT DREXDEL - EMAIL DELIVERY SERVICE
 * FILE: src/services/emailService.ts
 *
 * Production email transport via Nodemailer + SMTP. Works with any SMTP
 * relay (SendGrid, AWS SES, Resend, Mailgun, Gmail app passwords, ...).
 * When SMTP is not configured (dev/test), deliveries fall back to a
 * structured log entry so flows remain exercisable end-to-end.
 */
import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../config/logger';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Drexdel <no-reply@drexdel.app>';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailResult = { delivered: boolean; via: 'smtp' | 'log' };

/**
 * Deliver an email. Returns the transport used so callers can decide
 * whether to treat fallback delivery as acceptable in non-production.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const tr = getTransporter();
  if (!tr) {
    logger.info(
      { to: payload.to, subject: payload.subject },
      `[EMAIL LOG] ${payload.subject} :: ${payload.text.replace(/\n/g, ' | ')}`
    );
    return { delivered: false, via: 'log' };
  }

  try {
    await tr.sendMail({ from: SMTP_FROM, ...payload });
    logger.info({ to: payload.to, subject: payload.subject }, 'Email delivered via SMTP');
    return { delivered: true, via: 'smtp' };
  } catch (err) {
    logger.error({ err, to: payload.to }, 'SMTP delivery failed');
    return { delivered: false, via: 'log' };
  }
}

/** Convenience: build + deliver an OTP email for a given purpose. */
export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: 'password-reset' | 'email-verification'
): Promise<EmailResult> {
  const subject =
    purpose === 'password-reset'
      ? 'Reset your Drexdel password'
      : 'Verify your Drexdel email address';
  const body =
    purpose === 'password-reset'
      ? `Your Drexdel password reset code is: ${code}\nIt expires in 10 minutes. If you didn't request this, you can safely ignore this email.`
      : `Your Drexdel email verification code is: ${code}\nIt expires in 10 minutes.`;
  return sendEmail({ to, subject, text: body });
}