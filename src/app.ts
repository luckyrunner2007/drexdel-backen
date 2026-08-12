import express from 'express';
import http from 'http';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ALLOWED_ORIGINS, BACKEND_PORT, BACKEND_HOST, validateRuntimeEnv } from './config/env';
import { authController, loginSchema, otpRequestSchema, signupSchema, verifyOtpSchema, resetPasswordSchema, changePasswordSchema, verifyEmailSchema, verifyPhoneSchema } from './controllers/authController';
import { paymentController, checkoutSchema } from './controllers/paymentController';
import { ticketController, validateTicketSchema } from './controllers/ticketController';
import { chatController, sendMessageSchema, votePollSchema, reactionSchema, editMessageSchema, chatMediaUploadSchema } from './controllers/chatController';
import { socialController, updateMeSchema, searchUsersSchema, reportUserSchema } from './controllers/socialController';
import { presenceController, heartbeatSchema, presenceVisibilitySchema } from './controllers/presenceController';
import { errorReportController, reportErrorSchema, listErrorReportsSchema } from './controllers/errorReportController';
import { conversationController, startDmSchema, sendDmSchema, createGroupSchema, updateGroupSchema, addMembersSchema } from './controllers/conversationController';
import { postController, uploadMediaSchema, createPostSchema, createCommentSchema, shareSchema, editPostSchema, reportPostSchema } from './controllers/postController';
import { getAllEvents, createEvent, getEventById, createEventSchema, listEventsSchema } from './controllers/eventController';
import { requireAuth, requireRole } from './middleware/auth';
import { validateBody, validateQuery } from './middleware/validate';
import { errorHandler } from './middleware/errorHandler';
import { chatBroker } from './websocket/chatBroker';
import { checkDBHealth, disconnectDB } from './config/db';
import { logger } from './config/logger';
import { initMonitoring, captureError, recordRequest, getMetrics } from './config/monitoring';

validateRuntimeEnv();
initMonitoring();

const app = express();
const server = http.createServer(app);

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Let frontend handle CSP
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

// Metrics: count every request + its response status for the /metrics endpoint.
app.use((req, res, next) => {
  res.on('finish', () => recordRequest(res.statusCode));
  next();
});

// Rate limiting (scale: move to Redis store when multi-instance)
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  message: { error: 'Too many requests' }
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
    max: 20,
  message: { error: 'Too many attempts' }
});

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGINS;
  
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Stripe requires the untouched request body for webhook signature verification.
app.post('/v1/payments/stripe-webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook.bind(paymentController));

app.use(express.json({ limit: '10kb' }));

// Health checks
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDBHealth();
  logger.info({ path: req.path, dbHealthy }, 'Health check requested');
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/ready', async (req, res) => {
  // Kubernetes-style readiness probe
  const dbHealthy = await checkDBHealth();
  res.status(dbHealthy ? 200 : 503).json({ ready: dbHealthy });
});

// Metrics endpoint for monitoring/alerts. Returns process + request counters
// in a structured (Prometheus-style) shape consumable by a scraper or the
// health dashboard.
app.get('/metrics', (req, res) => {
  res.status(200).json(getMetrics());
});

// Routes
app.post('/v1/auth/login', strictLimiter, validateBody(loginSchema), authController.processLogin);
app.post('/v1/auth/signup', strictLimiter, validateBody(signupSchema), authController.signup);
app.post('/v1/auth/forgot-password', strictLimiter, validateBody(otpRequestSchema), authController.requestAccountRescueOtp);
app.post('/v1/auth/verify-otp', strictLimiter, validateBody(verifyOtpSchema), authController.verifyOtp.bind(authController));
app.post('/v1/auth/reset-password', strictLimiter, validateBody(resetPasswordSchema), authController.resetPassword.bind(authController));
app.post('/v1/auth/change-password', standardLimiter, requireAuth, validateBody(changePasswordSchema), authController.changePassword.bind(authController));
app.post('/v1/auth/logout', standardLimiter, requireAuth, authController.logout.bind(authController));
app.post('/v1/auth/send-verification', standardLimiter, requireAuth, authController.sendEmailVerificationCode.bind(authController));
app.post('/v1/auth/verify-email', standardLimiter, requireAuth, validateBody(verifyEmailSchema), authController.verifyEmailCode.bind(authController));
app.post('/v1/auth/send-phone-verification', standardLimiter, requireAuth, authController.sendPhoneVerificationCode.bind(authController));
app.post('/v1/auth/verify-phone', standardLimiter, requireAuth, validateBody(verifyPhoneSchema), authController.verifyPhoneCode.bind(authController));

app.get('/v1/events', standardLimiter, validateQuery(listEventsSchema), getAllEvents);
app.get('/v1/events/:id', standardLimiter, getEventById);
app.post('/v1/events', standardLimiter, requireAuth, requireRole('ORGANISER', 'ADMIN'), validateBody(createEventSchema), createEvent);

app.post('/v1/payments/checkout', standardLimiter, requireAuth, validateBody(checkoutSchema), paymentController.handleCheckout);
app.get('/v1/payments/status/:transactionId', standardLimiter, requireAuth, paymentController.getPaymentStatus);
app.post('/v1/payments/telecom-webhook', express.raw({ type: 'application/json' }), paymentController.handleTelecomCallback);

// Tickets / Wallet - public ticket CRUD for the mobile wallet + gate scan flow
app.get('/v1/tickets/me', standardLimiter, requireAuth, ticketController.listMyTickets.bind(ticketController));
app.get('/v1/tickets/:id', standardLimiter, requireAuth, ticketController.getTicket.bind(ticketController));
app.get('/v1/tickets/:id/qr', standardLimiter, requireAuth, ticketController.getQr.bind(ticketController));
app.post('/v1/tickets/:id/validate', strictLimiter, requireAuth, requireRole('STAFF', 'ADMIN'), validateBody(validateTicketSchema), ticketController.validateTicket.bind(ticketController));

// Chat / Bond Rooms (REST surface; realtime push is handled by chatBroker over Socket.IO)
app.get('/v1/chat/rooms', standardLimiter, requireAuth, chatController.listRooms.bind(chatController));
app.get('/v1/chat/rooms/:roomId/messages', standardLimiter, requireAuth, chatController.getRoomMessages.bind(chatController));
app.post('/v1/chat/rooms/:roomId/send', standardLimiter, requireAuth, validateBody(sendMessageSchema), chatController.sendMessage.bind(chatController));
app.patch('/v1/chat/rooms/:roomId/messages/:messageId', standardLimiter, requireAuth, validateBody(editMessageSchema), chatController.editMessage.bind(chatController));
app.delete('/v1/chat/rooms/:roomId/messages/:messageId', standardLimiter, requireAuth, chatController.deleteMessage.bind(chatController));
app.post('/v1/chat/rooms/:roomId/messages/:messageId/reactions', standardLimiter, requireAuth, validateBody(reactionSchema), chatController.toggleReaction.bind(chatController));
app.post('/v1/chat/rooms/:roomId/messages/:messageId/polls/:pollId/vote', standardLimiter, requireAuth, validateBody(votePollSchema), chatController.castPollVote.bind(chatController));
app.post('/v1/chat/media/upload-session', standardLimiter, requireAuth, validateBody(chatMediaUploadSchema), chatController.createMediaUploadSession.bind(chatController));

// Social graph (Event-Backed): profiles, follows, relationships, suggestions
// NOTE: specific routes MUST come before /v1/users/:identifier to avoid shadowing.
app.get('/v1/users/search', standardLimiter, requireAuth, validateQuery(searchUsersSchema), socialController.searchUsers.bind(socialController));
app.get('/v1/users/me/suggestions', standardLimiter, requireAuth, socialController.getSuggestions.bind(socialController));
app.get('/v1/users/me/relationship/:id', standardLimiter, requireAuth, socialController.getRelationship.bind(socialController));
app.post('/v1/users/:id/follow', standardLimiter, requireAuth, socialController.followUser.bind(socialController));
app.delete('/v1/users/:id/follow', standardLimiter, requireAuth, socialController.unfollowUser.bind(socialController));
app.post('/v1/users/:id/block', standardLimiter, requireAuth, socialController.blockUser.bind(socialController));
app.delete('/v1/users/:id/block', standardLimiter, requireAuth, socialController.unblockUser.bind(socialController));
app.post('/v1/users/:id/report', standardLimiter, requireAuth, validateBody(reportUserSchema), socialController.reportUser.bind(socialController));
app.get('/v1/users/:id/followers', standardLimiter, requireAuth, socialController.getFollowers.bind(socialController));
app.get('/v1/users/:id/following', standardLimiter, requireAuth, socialController.getFollowing.bind(socialController));
app.get('/v1/users/:identifier', standardLimiter, requireAuth, socialController.getPublicProfile.bind(socialController));
app.patch('/v1/users/me', standardLimiter, requireAuth, validateBody(updateMeSchema), socialController.updateMe.bind(socialController));

// Presence ("Who's here now") - ticket-verified + geofenced, friends-only
app.post('/v1/presence/heartbeat', standardLimiter, requireAuth, validateBody(heartbeatSchema), presenceController.heartbeat.bind(presenceController));
app.get('/v1/presence/events', standardLimiter, requireAuth, presenceController.getEventsWithFriendsPresent.bind(presenceController));
app.get('/v1/presence/notifications', standardLimiter, requireAuth, presenceController.getFriendArrivals.bind(presenceController));
app.delete('/v1/presence/notifications', standardLimiter, requireAuth, presenceController.clearFriendArrivals.bind(presenceController));
app.get('/v1/presence/visibility', standardLimiter, requireAuth, presenceController.getPresenceVisibility.bind(presenceController));
app.patch('/v1/presence/visibility', standardLimiter, requireAuth, validateBody(presenceVisibilitySchema), presenceController.setPresenceVisibility.bind(presenceController));

// Client-side crash reporting (React Native ErrorBoundary -> dev triage)
app.post('/v1/errors/report', standardLimiter, requireAuth, validateBody(reportErrorSchema), errorReportController.report.bind(errorReportController));
app.get('/v1/errors/reports', standardLimiter, requireAuth, requireRole('ADMIN'), validateQuery(listErrorReportsSchema), errorReportController.listReports.bind(errorReportController));

// Direct messages / conversations
app.get('/v1/conversations', standardLimiter, requireAuth, conversationController.listInbox.bind(conversationController));
app.post('/v1/conversations/dm', standardLimiter, requireAuth, validateBody(startDmSchema), conversationController.startOrGetDm.bind(conversationController));
app.get('/v1/conversations/:id/messages', standardLimiter, requireAuth, conversationController.getMessages.bind(conversationController));
app.post('/v1/conversations/:id/messages', standardLimiter, requireAuth, validateBody(sendDmSchema), conversationController.sendMessage.bind(conversationController));
app.post('/v1/conversations/:id/read', standardLimiter, requireAuth, conversationController.markRead.bind(conversationController));

// Group conversations
app.post('/v1/conversations/group', standardLimiter, requireAuth, validateBody(createGroupSchema), conversationController.createGroup.bind(conversationController));
app.patch('/v1/conversations/:id', standardLimiter, requireAuth, validateBody(updateGroupSchema), conversationController.updateGroup.bind(conversationController));
app.post('/v1/conversations/:id/members', standardLimiter, requireAuth, validateBody(addMembersSchema), conversationController.addMembers.bind(conversationController));
app.delete('/v1/conversations/:id/members/:userId', standardLimiter, requireAuth, conversationController.removeMember.bind(conversationController));
app.post('/v1/conversations/:id/leave', standardLimiter, requireAuth, conversationController.leaveGroup.bind(conversationController));
app.post('/v1/conversations/:id/members/:userId/admin', standardLimiter, requireAuth, conversationController.transferAdmin.bind(conversationController));
app.delete('/v1/conversations/:id', standardLimiter, requireAuth, conversationController.dissolveGroup.bind(conversationController));

// Media Posts / Upload Feature
app.post('/v1/media/upload-session', standardLimiter, requireAuth, validateBody(uploadMediaSchema), postController.createUploadSession.bind(postController));
app.post('/v1/posts', standardLimiter, requireAuth, validateBody(createPostSchema), postController.createPost.bind(postController));
app.get('/v1/posts/feed', standardLimiter, requireAuth, validateQuery(z.object({ page: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().default(1)), limit: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().max(100).default(20)), eventId: z.string().optional(), mediaType: z.enum(['IMAGE', 'VIDEO']).optional() })), postController.listFeed.bind(postController));
app.get('/v1/posts/saved', standardLimiter, requireAuth, validateQuery(z.object({ page: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().default(1)), limit: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().max(100).default(20)) })), postController.listSavedPosts.bind(postController));
app.get('/v1/posts/:id', standardLimiter, requireAuth, postController.getPost.bind(postController));
app.delete('/v1/posts/:id', standardLimiter, requireAuth, postController.deletePost.bind(postController));

app.get('/v1/posts/:id/comments', standardLimiter, requireAuth, validateQuery(z.object({ page: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().default(1)), limit: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().max(100).default(20)), parentCommentId: z.string().optional() })), postController.listComments.bind(postController));
app.post('/v1/posts/:id/comments', standardLimiter, requireAuth, validateBody(createCommentSchema), postController.createComment.bind(postController));
app.delete('/v1/posts/:id/comments/:commentId', standardLimiter, requireAuth, postController.deleteComment.bind(postController));

app.post('/v1/posts/:id/like', standardLimiter, requireAuth, postController.toggleLike.bind(postController));
app.get('/v1/posts/:id/likes', standardLimiter, requireAuth, validateQuery(z.object({ page: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().default(1)), limit: z.preprocess((v) => typeof v === 'string' ? Number(v) : v, z.number().int().positive().max(100).default(20)) })), postController.listLikes.bind(postController));

app.post('/v1/posts/:id/share', standardLimiter, requireAuth, validateBody(shareSchema), postController.sharePost.bind(postController));

app.patch('/v1/posts/:id', standardLimiter, requireAuth, validateBody(editPostSchema), postController.editPost.bind(postController));
app.post('/v1/posts/:id/report', standardLimiter, requireAuth, validateBody(reportPostSchema), postController.reportPost.bind(postController));
app.post('/v1/posts/:id/save', standardLimiter, requireAuth, postController.savePost.bind(postController));
app.get('/v1/posts/:id/saves', standardLimiter, requireAuth, postController.listSaves.bind(postController));

// Initialize WebSocket
chatBroker.initialize(server).catch((err) => logger.error({ err }, 'WebSocket broker failed to initialize'));

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutdown initiated');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await disconnectDB();
    logger.info('Drexdel services stopped');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }

  setTimeout(() => {
    logger.error('Forced exit after grace period');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handlers
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  captureError(err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const reasonErr = reason instanceof Error ? reason : new Error(String(reason));
  logger.fatal({ err: reasonErr }, 'Unhandled rejection');
  captureError(reasonErr);
});

// Export the Express app + underlying http server so integration tests and
// external harnesses can import them without binding to BACKEND_PORT.
export { app, server };

// Only bind to BACKEND_PORT when this module is executed directly (i.e. via
// `npm start` / `npm run dev`). When imported by tooling or tests, require.main
// is the importer, so we skip listening and leave the caller in control of the
// socket lifecycle.
if (require.main === module) {
  server.listen(BACKEND_PORT, BACKEND_HOST, () => {
    logger.info({ host: BACKEND_HOST, port: BACKEND_PORT }, 'Drexdel API started');
    logger.info({ adapter: process.env.USE_REDIS_ADAPTER || 'default' }, 'Redis adapter configured');
  });
}
