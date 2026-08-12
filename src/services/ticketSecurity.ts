/**
 * PROJECT DREXDEL - TICKET CRYPTOGRAPHIC SECURITY SERVICE
 * FILE: src/services/ticketSecurity.ts
 *
 * Server-authoritative helpers for minting and verifying the time-synced,
 * HMAC-SHA256 ticket credentials used by the venue gate scanner.
 *
 * The signature algorithm deliberately mirrors the one used at issuance time
 * by PaymentController.generateTicketSignature (same system salt + 30-second
 * epoch window) so that a freshly-minted QR (GET /tickets/:id/qr) can be
 * validated server-side at scan time (POST /tickets/:id/validate), with
 * tolerance for gate/device clock skew and protection against timing attacks.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Salt bound to issuance + verification. Mirrors PaymentController's salt. */
export const TICKET_SYSTEM_SALT = 'DREXDEL_CORE_SYSTEM_SALT';
/** Credential rotation window in seconds (a screenshot older than this is invalid). */
export const TICKET_EPOCH_SECONDS = 30;

export interface TicketSignaturePayload {
  ticketId: string;
  userId: string;
  eventId: string;
  tierId: string;
}

/**
 * Mints a time-synced HMAC-SHA256 signature for the given ticket / secret seed.
 *
 * The signature rotates every `TICKET_EPOCH_SECONDS`; presenting an
 * out-of-window / screenshot payload therefore fails server-side verification.
 */
export function generateTicketSignature(
  payload: TicketSignaturePayload,
  secretSeed: string,
  nowMs: number = Date.now()
): string {
  const epochBlock = Math.floor(nowMs / 1000 / TICKET_EPOCH_SECONDS);
  const base = [
    payload.ticketId,
    payload.userId,
    payload.eventId,
    String(epochBlock),
    secretSeed,
    TICKET_SYSTEM_SALT,
  ].join(':');
  const hash = createHmac('sha256', secretSeed).update(base).digest('hex');
  return `DREXDEL_SECURE_AUTH_${hash}_${payload.tierId}`;
}

/**
 * Verifies a scanned credential against the current 30-second window plus the
 * immediately-previous window (tolerates clock skew of up to one epoch).
 * Comparison is constant-time to resist timing attacks at the gate.
 */
export function verifyTicketSignature(
  provided: string,
  payload: TicketSignaturePayload,
  secretSeed: string,
  nowMs: number = Date.now()
): boolean {
  if (typeof provided !== 'string' || provided.length === 0 || provided.length > 4096) {
    return false;
  }
  if (!secretSeed) {
    return false;
  }
  const currentBlock = Math.floor(nowMs / 1000 / TICKET_EPOCH_SECONDS);
  for (const block of [currentBlock, currentBlock - 1]) {
    const expected = generateTicketSignature(payload, secretSeed, block * TICKET_EPOCH_SECONDS * 1000);
    if (constantTimeEqual(provided, expected)) {
      return true;
    }
  }
  return false;
}

/**
 * Constant-time string comparison.
 *
 * Uses Node's `timingSafeEqual` on backing Buffers, which never short-circuits
 * on a length mismatch beyond the (public) length check, mitigating timing
 * oracle attacks against the gate credential.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}
