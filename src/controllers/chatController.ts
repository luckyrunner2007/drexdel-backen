import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { chatBroker } from '../websocket/chatBroker';
import { supabaseAdmin, getSupabaseBucket, buildStoragePath } from '../config/supabase';

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
  callData: z.any().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'video']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    durationSeconds: z.number().optional(),
  })).optional(),
});

export const votePollSchema = z.object({
  selectedEventId: z.string().min(1).max(255),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
  action: z.enum(['add', 'remove']),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  messageType: z.enum(['TEXT', 'IMAGE', 'EVENT_CARD', 'POLL', 'SYSTEM']).optional(),
});

export const chatMediaUploadSchema = z.object({
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive().optional(),
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

  /** GET /v1/chat/rooms - list bond rooms the user has access to. */
  async listRooms(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;

      // Find all events where the user has a BOOKED ticket
      const tickets = await prisma.ticket.findMany({
        where: { userId, status: 'BOOKED' as any },
        select: { eventId: true },
        distinct: ['eventId'],
      });

      const eventIds = tickets.map(t => t.eventId);
      if (eventIds.length === 0) {
        res.status(200).json({ success: true, rooms: [] });
        return;
      }

      const events = await prisma.event.findMany({
        where: { id: { in: eventIds }, status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          description: true,
          coverImageUrl: true,
          date: true,
          location: true,
          category: true,
        },
        orderBy: { date: 'desc' },
      });

      const rooms = events.map(event => ({
        id: `event_${event.id}`,
        name: event.title,
        description: event.description,
        avatarUrl: event.coverImageUrl,
        eventId: event.id,
        eventDate: event.date.toISOString(),
        location: event.location,
        category: event.category,
      }));

      res.status(200).json({ success: true, rooms });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'List rooms error');
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
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
          reactions: {},
          ...(data.attachments ? { attachments: data.attachments } : {}),
          ...(data.callData ? { callData: data.callData } : {}),
        },
        include: {
          sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
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

  /** POST /v1/chat/rooms/:roomId/messages/:messageId/reactions - toggle a reaction. */
  async toggleReaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
      const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;

      if (!(await this.verifyRoomAccess(userId, roomId))) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const data = (req as any).validatedBody || reactionSchema.parse(req.body);
      const { emoji, action } = data;

      const message = await prisma.message.findFirst({
        where: { id: messageId, roomId, isSoftDeleted: false },
        select: { id: true, reactions: true },
      });

      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      const reactions = (message.reactions as Record<string, string[]>) || {};
      const current = reactions[emoji] || [];

      let updatedReactions: Record<string, string[]>;
      if (action === 'add') {
        if (!current.includes(userId)) {
          updatedReactions = { ...reactions, [emoji]: [...current, userId] };
        } else {
          updatedReactions = reactions; // already reacted
        }
      } else {
        updatedReactions = { ...reactions };
        updatedReactions[emoji] = current.filter(id => id !== userId);
        if (updatedReactions[emoji].length === 0) {
          delete updatedReactions[emoji];
        }
      }

      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { reactions: updatedReactions },
        include: { sender: { select: { id: true, name: true } } },
      });

      res.status(200).json({ success: true, reactions: updated.reactions });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Toggle reaction error');
      res.status(500).json({ error: 'Failed to toggle reaction' });
    }
  }

  /**
   * PATCH /v1/chat/rooms/:roomId/messages/:messageId
   * Owner-only, room-gated edit. Marks the message as edited and records
   * editedAt for audit/UI badges. Broadcasts `message_updated` over the
   * room socket so every member's feed updates in real time.
   */
  async editMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
      const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;

      if (!(await this.verifyRoomAccess(userId, roomId))) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const data = (req as any).validatedBody || editMessageSchema.parse(req.body);

      const existing = await prisma.message.findFirst({
        where: { id: messageId, roomId, isSoftDeleted: false },
        select: { id: true, senderId: true },
      });
      if (!existing) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      // Only the original sender may edit a message.
      if (existing.senderId !== userId) {
        res.status(403).json({ error: 'You can only edit your own messages' });
        return;
      }

      const updated = await prisma.message.update({
        where: { id: existing.id },
        data: { content: data.content, isEdited: true, editedAt: new Date() },
        include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      });

      // Real-time fan-out to everyone in the room.
      chatBroker.broadcastToRoom(roomId, 'message_updated', { roomId, message: updated }).catch(() => {});

      res.status(200).json({ success: true, message: updated });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Edit message error');
      res.status(500).json({ error: 'Failed to edit message' });
    }
  }


  /**
   * DELETE /v1/chat/rooms/:roomId/messages/:messageId
   * Owner-only, room-gated soft delete. Sets isSoftDeleted + deletedAt +
   * deletedBy so clients show a "Message deleted" placeholder instead of
   * losing graph continuity. Broadcasts `message_deleted` over the room
   * socket for instant client-side removal.
   */
  async deleteMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
      const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;

      if (!(await this.verifyRoomAccess(userId, roomId))) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const existing = await prisma.message.findFirst({
        where: { id: messageId, roomId, isSoftDeleted: false },
        select: { id: true, senderId: true },
      });
      if (!existing) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      // Only the original sender (or an admin/staff) may delete a message.
      if (existing.senderId !== userId && !['STAFF', 'ADMIN'].includes(req.user!.role || '')) {
        res.status(403).json({ error: 'You can only delete your own messages' });
        return;
      }

      const deleted = await prisma.message.update({
        where: { id: existing.id },
        data: { isSoftDeleted: true, deletedAt: new Date(), deletedBy: userId },
      });

      chatBroker.broadcastToRoom(roomId, 'message_deleted', { roomId, messageId: deleted.id }).catch(() => {});

      res.status(200).json({ success: true, messageId: deleted.id });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Delete message error');
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  /**
   * POST /v1/chat/media/upload-session
   * Mints a scoped Supabase signed upload URL for chat media. The client
   * PUTs the file directly to the CDN, then references the returned URL in
   * an IMAGE/VIDEO sendMessage payload. Mirrors the posts media flow so the
   * pipeline is consistent and horizontally scalable.
   */
  async createMediaUploadSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const body = (req as any).validatedBody || chatMediaUploadSchema.parse(req.body);

      const ALLOWED_MIME_TYPES: Record<string, string[]> = {
        IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
        VIDEO: ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'],
      };
      const MAX_SIZE: Record<string, number> = { IMAGE: 15 * 1024 * 1024, VIDEO: 100 * 1024 * 1024 };

      if (!ALLOWED_MIME_TYPES[body.mediaType].includes(body.mimeType)) {
        res.status(400).json({ error: 'Invalid file type. Allowed: ' + ALLOWED_MIME_TYPES[body.mediaType].join(', ') });
        return;
      }
      if (body.fileSize && body.fileSize > MAX_SIZE[body.mediaType]) {
        res.status(400).json({ error: 'File too large. Max size: ' + (MAX_SIZE[body.mediaType] / 1024 / 1024) + 'MB' });
        return;
      }

      const tempId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      const fileKey = buildStoragePath(`chat/${userId}`, tempId, body.filename);
      const bucket = getSupabaseBucket();
      if (!supabaseAdmin) {
        res.status(503).json({ error: 'Media storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
        return;
      }
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(fileKey, { upsert: false });
      if (error || !data?.signedUrl) {
        logger.error({ err: error }, 'Chat media signed URL failed');
        res.status(500).json({ error: 'Failed to create upload session' });
        return;
      }

      res.status(200).json({ uploadUrl: data.signedUrl, fileKey, bucket });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Chat media upload session error');
      res.status(500).json({ error: 'Failed to create upload session' });
    }
  }
}

export const chatController = new ChatController();
