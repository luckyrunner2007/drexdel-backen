import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

/**
 * PROJECT DREXDEL - REAL-TIME CHAT REST CONTROLLER
 * FILE: src/controllers/chatController.ts
 *
 * Backs the REST endpoints the mobile client already calls for group
 * "Bond Rooms". Realtime delivery itself happens over Socket.IO (see
 * src/websocket/chatBroker.ts); these routes provide the durable REST
 * surface for history, sending, and poll voting so the API is complete
 * and consistent with the socket path.
 *
 * Rooms are event-scoped and ticket-gated: a user may only read/send in a
 * room (roomId format "event_{eventId}") when they hold a BOOKED ticket
 * for that event. This mirrors chatBroker.verifyRoomAccess.
 */

// Validation schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  messageType: z.enum(['TEXT', 'IMAGE', 'EVENT_CARD', 'POLL', 'SYSTEM']).default('TEXT'),
  sharedEventId: z.string().optional(),
  pollData: z.any().optional(),
});

export const votePollSchema = z.object({
  selectedEventId: z.string().min(1).max(255),
});

function extractEventId(roomId: string): string | null {
  return roomId.startsWith('event_') ? roomId.slice('event_'.length) : null;
}

class ChatController {
  /**
   * Resolve the gateway: REST routes enforce the same ticket rule that the
   * socket broker does, so the two delivery paths never diverge.
   */
  private async verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
    const eventId = extractEventId(roomId);
    if (!eventId) return false;

    const ticket = await prisma.ticket.findFirst({
      where: { userId, eventId, status: 'BOOKED' as any },
    });
    return !!ticket;
  }

  /** GET /v1/chat/rooms/:roomId/messages - recent history for a room. */
  async getRoomMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;

      if (!(await this.verifyRoomAccess(userId, roomId))) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

      // Cursor pagination: `before` is an ISO timestamp (exclusive) for
      // "load older" paging; when omitted we return the newest `limit` messages.
      const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;

      const history = await prisma.message.findMany({
        where: {
          roomId,
          isSoftDeleted: false,
          ...(before ? { createdAt: { lt: before } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          sender: { select: { id: true, name: true } },
        },
      });

      // Oldest -> newest for the client, plus a cursor to fetch earlier pages.
      const reversed = history.reverse();
      res.status(200).json({
        success: true,
        messages: reversed,
        nextCursor: reversed.length > 0 ? reversed[0].createdAt.toISOString() : null,
      });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Room messages error');
      res.status(500).json({ error: 'Failed to fetch room messages' });
    }
  }

  /** POST /v1/chat/rooms/:roomId/send - persist a new message in a room. */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
      const data = (req as any).validatedBody || sendMessageSchema.parse(req.body);

      if (!(await this.verifyRoomAccess(userId, roomId))) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          roomId,
          senderId: userId,
          content: data.content,
          messageType: data.messageType,
          pollData: data.pollData || undefined,
        },
        include: {
          sender: { select: { id: true, name: true } },
        },
      });

      res.status(201).json({ success: true, message });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Send message error');
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  /**
   * POST /v1/chat/rooms/:roomId/messages/:messageId/polls/:pollId/vote
   * Casts (or re-casts, preserving single-choice semantics) a vote on a poll
   * stored in the message's `pollData` JSON. Mirrors MessageModel.mutatePollVote
   * but against the durable Prisma Message row.
   */
  async castPollVote(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
      const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
      const pollId = Array.isArray(req.params.pollId) ? req.params.pollId[0] : req.params.pollId;

      const data = (req as any).validatedBody || votePollSchema.parse(req.body);
      const selectedEventId = data.selectedEventId;

      if (!(await this.verifyRoomAccess(userId, roomId))) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const message = await prisma.message.findFirst({
        where: { id: messageId, roomId, isSoftDeleted: false },
        include: { sender: { select: { id: true, name: true } } },
      });

      const raw = message?.pollData as any;
      if (!message || !raw || raw.id !== pollId || !Array.isArray(raw.options)) {
        res.status(404).json({ error: 'Poll not found' });
        return;
      }

      // Single-choice semantics: add vote to selected option, remove from others.
      const updatedOptions = raw.options.map((option: any) => {
        const alreadySelected = Array.isArray(option.votedUserIds)
          ? option.votedUserIds.includes(userId)
          : false;
        const isTarget = option.eventId === selectedEventId;

        if (isTarget) {
          return {
            ...option,
            votesCount: alreadySelected ? option.votesCount : (option.votesCount || 0) + 1,
            votedUserIds: alreadySelected ? option.votedUserIds : [...(option.votedUserIds || []), userId],
          };
        }
        return {
          ...option,
          votesCount: alreadySelected ? Math.max(0, (option.votesCount || 0) - 1) : option.votesCount || 0,
          votedUserIds: Array.isArray(option.votedUserIds) ? option.votedUserIds.filter((id: string) => id !== userId) : [],
        };
      });

      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { pollData: { ...raw, options: updatedOptions } },
        include: { sender: { select: { id: true, name: true } } },
      });

      res.status(200).json({ success: true, updatedPoll: updated.pollData });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Cast poll vote error');
      res.status(500).json({ error: 'Failed to cast vote' });
    }
  }
}

export const chatController = new ChatController();
