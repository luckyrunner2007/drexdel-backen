/**
 * PROJECT DREXDEL - TICKET WALLET & GATE VALIDATION CONTROLLER
 * FILE: src/controllers/ticketController.ts
 *
 * Public ticket surface for the mobile wallet + the venue gate scan flow.
 *
 * Security model:
 *   - GET /tickets/me            -> owner lists their own tickets.
 *   - GET /tickets/:id           -> owner OR staff/admin (IDOR protected).
 *   - GET /tickets/:id/qr        -> owner OR staff/admin; mints a FRESH,
 *                                    30-second-rotating HMAC credential for
 *                                    display/scanning (so screenshots are
 *                                    time-bound).
 *   - POST /tickets/:id/validate -> STAFF/ADMIN only; server-authoritative
 *                                    gate scan: verifies the scanned credential
 *                                    against the ticket's secret seed, then
 *                                    atomically redeems BOOKED -> USED in a
 *                                    transaction (one-time use).
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import {
  generateTicketSignature,
  verifyTicketSignature,
  TicketSignaturePayload,
} from '../services/ticketSecurity';

/** Staff/Admin roles recognised by the gate scan endpoint. */
const STAFF_ROLES = ['STAFF', 'ADMIN'];

export const validateTicketSchema = z.object({
  qrCodeString: z.string().min(1),
});

export type WalletTicketStatus = 'booked' | 'checked_in' | 'refunded' | 'cancelled';

export interface WalletTicketDto {
  id: string;
  eventId: string;
  userId: string;
  tierId: string;
  status: WalletTicketStatus;
  qrCodeString: string;
  cryptographicToken: string;
  purchaseTimestamp: string;
  event: { title: string; date: string; location: string; coverImageUrl: string | null } | null;
  tier: { name: string; price: number; currency: string } | null;
}

const STATUS_MAP: Record<string, WalletTicketStatus> = {
  BOOKED: 'booked',
  USED: 'checked_in',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
};

/** Maps a raw Prisma Ticket (incl. event + tier) to the wallet DTO. */
function mapWalletTicket(t: any): WalletTicketDto {
  const status = (t.status || 'BOOKED').toUpperCase();
  return {
    id: t.id,
    eventId: t.eventId,
    userId: t.userId,
    tierId: t.tierId,
    status: STATUS_MAP[status] ?? 'cancelled',
    qrCodeString: t.qrCodeString,
    cryptographicToken: t.cryptographicToken,
    purchaseTimestamp:
      t.purchaseTimestamp || (t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()),
    event: t.event
      ? {
          title: t.event.title,
          date: t.event.date,
          location: t.event.location,
          coverImageUrl: t.event.coverImageUrl ?? null,
        }
      : null,
    tier: t.tier
      ? {
          name: t.tier.name,
          price: Number(t.tier.price),
          currency: t.tier.currency,
        }
      : null,
  };
}

/** IDOR guard: a ticket may be accessed by its owner or a staff/admin. */
function canAccessTicket(ticket: { userId: string }, user: { sub: string; role: string }): boolean {
  return ticket.userId === user.sub || STAFF_ROLES.includes(user.role);
}

export class TicketController {
  /** GET /v1/tickets/me - list the authenticated user's tickets. */
  public async listMyTickets(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const tickets = await prisma.ticket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { event: true, tier: true },
      });
      res.status(200).json({ success: true, tickets: tickets.map(mapWalletTicket) });
    } catch (err: any) {
      logger.error({ err, path: req.path }, 'Failed to list tickets');
      res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
    }
  }

  /** GET /v1/tickets/:id - fetch a single ticket (IDOR protected). */
    public async getTicket(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = req.user!;
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { event: true, tier: true },
      });
      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found' });
        return;
      }
      if (!canAccessTicket(ticket, user)) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
      res.status(200).json({ success: true, ticket: mapWalletTicket(ticket) });
    } catch (err: any) {
      logger.error({ err, path: req.path }, 'Failed to fetch ticket');
      res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
    }
  }

  /** GET /v1/tickets/:id/qr - mint a fresh rotating credential (IDOR protected). */
    public async getQr(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = req.user!;
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found' });
        return;
      }
      if (!canAccessTicket(ticket, user)) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
      const payload: TicketSignaturePayload = {
        ticketId: ticket.id,
        userId: ticket.userId,
        eventId: ticket.eventId,
        tierId: ticket.tierId,
      };
      const qrCodeString = generateTicketSignature(payload, ticket.cryptographicToken);
      res.status(200).json({ success: true, qrCodeString });
    } catch (err: any) {
      logger.error({ err, path: req.path }, 'Failed to mint ticket QR');
      res.status(500).json({ success: false, message: 'Failed to mint ticket QR' });
    }
  }

  /** POST /v1/tickets/:id/validate - staff gate scan: verify + atomically redeem. */
  public async validateTicket(req: Request, res: Response): Promise<void> {
    const body = (req as any).validatedBody ?? req.body;
    const qrCodeString = body?.qrCodeString;
    if (typeof qrCodeString !== 'string' || qrCodeString.length === 0) {
      res.status(400).json({ success: false, valid: false, message: 'qrCodeString is required' });
      return;
    }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found' });
        return;
      }

      const payload: TicketSignaturePayload = {
        ticketId: ticket.id,
        userId: ticket.userId,
        eventId: ticket.eventId,
        tierId: ticket.tierId,
      };

      // Server-authoritative, constant-time verification of the scanned credential.
      if (!verifyTicketSignature(qrCodeString, payload, ticket.cryptographicToken)) {
        logger.warn({ ticketId: ticket.id, path: req.path }, 'Gate scan rejected: invalid credential');
        res.status(401).json({ success: false, valid: false, message: 'Invalid ticket credential' });
        return;
      }

      // One-time use: only BOOKED tickets may be redeemed.
      if (ticket.status !== 'BOOKED') {
        res.status(409).json({
          success: false,
          valid: false,
          message: `Ticket is ${ticket.status.toLowerCase()}`,
          status: ticket.status.toLowerCase(),
        });
        return;
      }

      // Atomic redemption: BOOKED -> USED within a single transaction.
      await prisma.$transaction(async (tx: any) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: 'USED', usedAt: new Date(), usedBy: req.user!.sub },
        });
      });

      logger.info({ ticketId: ticket.id, scannedBy: req.user!.sub }, 'Ticket validated at gate');
      res.status(200).json({
        success: true,
        valid: true,
        ticket: { id: ticket.id, eventId: ticket.eventId, tierId: ticket.tierId, status: 'used' },
      });
    } catch (err: any) {
      logger.error({ err, path: req.path }, 'Ticket validation failed');
      res.status(500).json({ success: false, valid: false, message: 'Ticket validation failed' });
    }
  }
}

export const ticketController = new TicketController();

