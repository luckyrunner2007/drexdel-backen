/**
 * PROJECT DREXDEL - SMS DELIVERY SERVICE
 * FILE: src/services/smsService.ts
 *
 * Production SMS transport via Twilio. When credentials are missing
 * (dev/test) deliveries fall back to a structured log entry so OTP
 * flows remain exercisable end-to-end.
 */
import { logger } from '../config/logger';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

export type SmsResult = { delivered: boolean; via: 'twilio' | 'log' };

/**
 * Deliver an SMS message. Uses a dynamic require so the twilio client is
 * only loaded when credentials are configured.
 */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    logger.info({ to }, `[SMS LOG] ${message}`);
    return { delivered: false, via: 'log' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to,
      from: TWILIO_FROM_NUMBER,
      body: message,
    });
    logger.info({ to }, 'SMS delivered via Twilio');
    return { delivered: true, via: 'twilio' };
  } catch (err) {
    logger.error({ err, to }, 'SMS delivery failed');
    return { delivered: false, via: 'log' };
  }
}

/** Convenience: build + deliver an OTP text for phone verification. */
export async function sendOtpSms(
  to: string,
  code: string,
  purpose: 'phone-verification' | 'password-reset'
): Promise<SmsResult> {
  const message =
    purpose === 'phone-verification'
      ? `Your Drexdel phone verification code is: ${code}. It expires in 10 minutes.`
      : `Your Drexdel password reset code is: ${code}. It expires in 10 minutes.`;
  return sendSms(to, message);
}