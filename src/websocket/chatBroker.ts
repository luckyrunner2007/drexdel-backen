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

      socket.on('send_message', async (data: { roomId: string; content: string; messageType?: string }) => {
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
          },
          include: {
            sender: { select: { id: true, name: true } }
          }
        });

        socket.emit('message_ack', { messageId: message.id });

        // Broadcast
        socket.to(data.roomId).emit('new_message', message);
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