import express from 'express';
import http from 'http';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ALLOWED_ORIGINS, BACKEND_PORT, BACKEND_HOST, validateRuntimeEnv } from './config/env';
import { authController, loginSchema, otpRequestSchema, signupSchema } from './controllers/authController';
import { paymentController, checkoutSchema } from './controllers/paymentController';
import { chatController, sendMessageSchema, votePollSchema } from './controllers/chatController';
import { socialController, updateMeSchema } from './controllers/socialController';
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
  max: 10,
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

app.get('/v1/events', standardLimiter, validateQuery(listEventsSchema), getAllEvents);
app.get('/v1/events/:id', standardLimiter, getEventById);
app.post('/v1/events', standardLimiter, requireAuth, requireRole('ORGANISER', 'ADMIN'), validateBody(createEventSchema), createEvent);

app.post('/v1/payments/checkout', standardLimiter, requireAuth, validateBody(checkoutSchema), paymentController.handleCheckout);
app.get('/v1/payments/status/:transactionId', standardLimiter, requireAuth, paymentController.getPaymentStatus);
app.post('/v1/payments/telecom-webhook', express.raw({ type: 'application/json' }), paymentController.handleTelecomCallback);

// Chat / Bond Rooms (REST surface; realtime push is handled by chatBroker over Socket.IO)
app.get('/v1/chat/rooms/:roomId/messages', standardLimiter, requireAuth, chatController.getRoomMessages.bind(chatController));
app.post('/v1/chat/rooms/:roomId/send', standardLimiter, requireAuth, validateBody(sendMessageSchema), chatController.sendMessage.bind(chatController));
app.post('/v1/chat/rooms/:roomId/messages/:messageId/polls/:pollId/vote', standardLimiter, requireAuth, validateBody(votePollSchema), chatController.castPollVote.bind(chatController));

// Social graph (Event-Backed): profiles, follows, relationships, suggestions
app.get('/v1/users/:identifier', standardLimiter, requireAuth, socialController.getPublicProfile.bind(socialController));
app.patch('/v1/users/me', standardLimiter, requireAuth, validateBody(updateMeSchema), socialController.updateMe.bind(socialController));
app.get('/v1/users/me/suggestions', standardLimiter, requireAuth, socialController.getSuggestions.bind(socialController));
app.get('/v1/users/me/relationship/:id', standardLimiter, requireAuth, socialController.getRelationship.bind(socialController));
app.post('/v1/users/:id/follow', standardLimiter, requireAuth, socialController.followUser.bind(socialController));
app.delete('/v1/users/:id/follow', standardLimiter, requireAuth, socialController.unfollowUser.bind(socialController));

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
