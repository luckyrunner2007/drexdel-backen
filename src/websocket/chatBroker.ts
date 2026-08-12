import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { getRedisClient } from '../config/redis';
import { ALLOWED_ORIGINS } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';

interface ActiveSession {
  socketId: string;
  userId: string;
  roomId: string;
  joinedAt: Date;
}

class ChatBroker {
  private io: SocketServer | null = null;
  private sessions: Map<string, ActiveSession> = new Map();
  private redisAdapterEnabled = false;

  async initialize(httpServer: HttpServer): Promise<void> {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const allowed = ALLOWED_ORIGINS;
          if (!origin || allowed.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 10000,
      pingInterval: 5000,
      transports: ['websocket', 'polling'], // polling fallback for mobile
    });

    // Scale: Redis adapter — toggle via env
    if (process.env.USE_REDIS_ADAPTER === 'true') {
      try {
        const pubClient = await getRedisClient();
        if (!pubClient) throw new Error('Redis unavailable for socket adapter');
        const subClient = pubClient.duplicate();
        await subClient.connect();
        const { createAdapter } = require('@socket.io/redis-adapter');
        this.io.adapter(createAdapter(pubClient, subClient));
        this.redisAdapterEnabled = true;
                logger.info('Redis adapter enabled for socket scaling');
      } catch (err) {
                logger.warn({ err }, 'Redis adapter failed, falling back to in-memory');
      }
    }

    this.io.use(async (socket: Socket, next) => {
      // JWT auth for sockets
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        (socket as any).userId = payload.sub;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
            logger.info({ socketId: socket.id, userId }, 'Socket connected');

      // Personal channel for inbox-level notifications (new DM previews, etc).
      socket.join(`user_${userId}`);

      socket.on('join_room', async (data: { roomId: string }) => {
        const { roomId } = data;
        
        // Verify user is part of this event/ticket
        const hasAccess = await this.verifyRoomAccess(userId, roomId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(roomId);
        this.sessions.set(socket.id, {
          socketId: socket.id,
          userId,
          roomId,
          joinedAt: new Date(),
        });

        // Send recent history
        const history = await prisma.message.findMany({
          where: { roomId, isSoftDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            sender: { select: { id: true, name: true } }
          }
        });

        socket.emit('room_history', history.reverse());

        // Notify room
        socket.to(roomId).emit('user_joined', { userId, timestamp: new Date().toISOString() });
      });

      socket.on('send_message', async (data: { roomId: string; content: string; messageType?: string; attachments?: any[]; pollData?: any }) => {
        const session = this.sessions.get(socket.id);
        if (!session || session.roomId !== data.roomId) {
          socket.emit('error', { message: 'Not joined to room' });
          return;
        }

        const messageType = typeof data.messageType === 'string' ? data.messageType : 'TEXT';

        // Persist
        const message = await prisma.message.create({
          data: {
            roomId: data.roomId,
            senderId: userId,
            content: data.content,
            messageType: messageType as any,
            reactions: {},
            ...(data.attachments ? { attachments: data.attachments } : {}),
            ...(data.pollData ? { pollData: data.pollData } : {}),
          },
          include: {
            sender: { select: { id: true, name: true } }
          }
        });

        socket.emit('message_ack', { messageId: message.id });

        // Broadcast
        socket.to(data.roomId).emit('new_message', message);
      });

      // ---- Real-time editing / deletion (REST persists; socket fans out) ----
      socket.on('edit_message', async (data: { roomId: string; messageId: string }) => {
        const session = this.sessions.get(socket.id);
        if (!session || session.roomId !== data.roomId) return;
        socket.to(data.roomId).emit('message_editing', { roomId: data.roomId, messageId: data.messageId, userId });
      });

      // ---- Voice / Video call signaling (WebRTC handshake over the socket) ----
      // The media plane is peer-to-peer (WebRTC); these events only shuttle
      // signaling + presence so calls are O(1) per media stream and scale with
      // the existing socket.io + Redis-adapter fan-out.

      socket.on('call:offer', async (data: {
        roomId: string; callId: string; calleeUserId: string; mode: 'audio' | 'video'; sdp?: any;
      }) => {
        if (!data?.roomId || !data?.calleeUserId || !data?.callId) return;
        const hasAccess = await this.verifyRoomAccess(userId, data.roomId);
        const calleeAccess = await this.verifyRoomAccess(data.calleeUserId, data.roomId);
        if (!hasAccess || !calleeAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        // Wake the callee (their personal channel) with the incoming-call payload.
        this.io?.to(`user_${data.calleeUserId}`).emit('call:incoming', {
          roomId: data.roomId, callId: data.callId, callerUserId: userId, calleeUserId: data.calleeUserId,
          mode: data.mode, sdp: data.sdp, startedAt: new Date().toISOString(),
        });
        // Room-wide presence: "someone is calling".
        socket.to(data.roomId).emit('call:ringing', {
          roomId: data.roomId, callId: data.callId, callerUserId: userId, calleeUserId: data.calleeUserId, mode: data.mode,
        });
      });

      socket.on('call:answer', async (data: { roomId: string; callId: string; callerUserId: string; sdp?: any }) => {
        if (!data?.roomId || !data?.callId || !data?.callerUserId) return;
        const hasAccess = await this.verifyRoomAccess(userId, data.roomId);
        const callerAccess = await this.verifyRoomAccess(data.callerUserId, data.roomId);
        if (!hasAccess || !callerAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        // Deliver the answer SDP back to the caller's personal channel.
        this.io?.to(`user_${data.callerUserId}`).emit('call:answer', {
          roomId: data.roomId, callId: data.callId, calleeUserId: userId, sdp: data.sdp, answeredAt: new Date().toISOString(),
        });
        socket.to(data.roomId).emit('call:accepted', {
          roomId: data.roomId, callId: data.callId, callerUserId: data.callerUserId, calleeUserId: userId,
        });
      });

      socket.on('call:ice-candidate', async (data: { roomId: string; callId: string; targetUserId: string; candidate: any }) => {
        if (!data?.roomId || !data?.callId || !data?.targetUserId) return;
        const hasAccess = await this.verifyRoomAccess(userId, data.roomId);
        const targetAccess = await this.verifyRoomAccess(data.targetUserId, data.roomId);
        if (!hasAccess || !targetAccess) return;
        this.io?.to(`user_${data.targetUserId}`).emit('call:ice-candidate', {
          roomId: data.roomId, callId: data.callId, fromUserId: userId, candidate: data.candidate,
        });
      });

      socket.on('call:reject', (data: { roomId: string; callId: string; callerUserId: string }) => {
        if (!data?.roomId || !data?.callId) return;
        this.io?.to(`user_${data.callerUserId}`).emit('call:reject', {
          roomId: data.roomId, callId: data.callId, userId, rejectedAt: new Date().toISOString(),
        });
        socket.to(data.roomId).emit('call:reject', {
          roomId: data.roomId, callId: data.callId, userId,
        });
      });

      socket.on('call:cancel', (data: { roomId: string; callId: string }) => {
        if (!data?.roomId || !data?.callId) return;
        socket.to(data.roomId).emit('call:cancel', { roomId: data.roomId, callId: data.callId, userId });
      });

      socket.on('call:end', (data: { roomId: string; callId: string }) => {
        if (!data?.roomId || !data?.callId) return;
        socket.to(data.roomId).emit('call:end', { roomId: data.roomId, callId: data.callId, userId });
      });


      // ---- Direct messages ----
      socket.on('join_dm', async (data: { conversationId: string }) => {
        const conversationId = data?.conversationId;
        if (!conversationId) {
          socket.emit('error', { message: 'conversationId required' });
          return;
        }
        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (!member) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        const roomId = `dm_${conversationId}`;
        socket.join(roomId);
        this.sessions.set(socket.id, {
          socketId: socket.id,
          userId,
          roomId,
          joinedAt: new Date(),
        });

        const history = await prisma.message.findMany({
          where: { conversationId, isSoftDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
        });
        socket.emit('dm_history', history.reverse());
      });

      socket.on('send_dm', async (data: { conversationId: string; content: string; messageType?: string }) => {
        const conversationId = data?.conversationId;
        const content = typeof data?.content === 'string' ? data.content.trim() : '';
        if (!conversationId || !content) {
          socket.emit('error', { message: 'conversationId and content required' });
          return;
        }
        if (content.length > 5000) {
          socket.emit('error', { message: 'Message too long' });
          return;
        }

        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (!member) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const messageType = typeof data.messageType === 'string' ? data.messageType : 'TEXT';
        const now = new Date();
        const preview = content.length > 140 ? `${content.slice(0, 137)}...` : content;

        const message = await prisma.$transaction(async (tx) => {
          const created = await tx.message.create({
            data: {
              conversationId,
              senderId: userId,
              content,
              messageType: messageType as any,
              deliveredAt: now,
            },
            include: {
              sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
            },
          });
          await tx.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: now, lastMessagePreview: preview },
          });
          await tx.conversationMember.update({
            where: { conversationId_userId: { conversationId, userId } },
            data: { lastReadAt: now },
          });
          return created;
        });

        const roomId = `dm_${conversationId}`;
        socket.emit('dm_ack', { messageId: message.id });
        socket.to(roomId).emit('new_dm', message);

        const peers = await prisma.conversationMember.findMany({
          where: { conversationId, userId: { not: userId } },
          select: { userId: true },
        });
        for (const peer of peers) {
          this.io?.to(`user_${peer.userId}`).emit('dm_inbox_update', {
            conversationId,
            lastMessageAt: now.toISOString(),
            lastMessagePreview: preview,
            from: message.sender,
          });
        }
      });

      socket.on('typing_dm', async (data: { conversationId: string; isTyping: boolean }) => {
        const conversationId = data?.conversationId;
        if (!conversationId) return;
        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (!member) return;
        socket.to(`dm_${conversationId}`).emit('typing_dm', {
          conversationId,
          userId,
          isTyping: !!data.isTyping,
        });
      });

      // ---- Group conversations ----
      socket.on('join_group', async (data: { conversationId: string }) => {
        const conversationId = data?.conversationId;
        if (!conversationId) {
          socket.emit('error', { message: 'conversationId required' });
          return;
        }
        const member = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
        });
        if (!member) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        const roomId = `dm_${conversationId}`;
        socket.join(roomId);
        this.sessions.set(socket.id, {
          socketId: socket.id,
          userId,
          roomId,
          joinedAt: new Date(),
        });

        const history = await prisma.message.findMany({
          where: { conversationId, isSoftDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
        });
        socket.emit('dm_history', history.reverse());
      });

      socket.on('disconnect', () => {
        const session = this.sessions.get(socket.id);
        if (session) {
          this.sessions.delete(socket.id);
          socket.to(session.roomId).emit('user_left', { userId: session.userId });
        }
      });
    });
  }

  private async verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
    // roomId format: "event_{eventId}" or "ticket_{ticketId}"
    // Check if user has ticket for this event
    const eventId = roomId.startsWith('event_') ? roomId.slice(6) : null;
    if (!eventId) return false;

    const ticket = await prisma.ticket.findFirst({
      where: { userId, eventId, status: 'BOOKED' }
    });

    return !!ticket;
  }

  // Scale: broadcast across instances via Redis
  async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    this.io?.to(roomId).emit(event, data);
  }
}

export const chatBroker = new ChatBroker();