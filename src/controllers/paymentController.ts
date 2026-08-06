import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { getRedisConnection, getRedisClient } from '../config/redis';
import { Queue } from 'bullmq';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { cardGateway } from '../services/payment/gatewayFactory';
import { STRIPE_WEBHOOK_SECRET, TELECOM_WEBHOOK_SECRET } from '../config/env';
import { logger } from '../config/logger';

// Initialize queues (lazy — survives if Redis is down briefly)
let paymentLedgerQueue: Queue | null = null;

function getPaymentQueue(): Queue {
  if (!paymentLedgerQueue) {
    paymentLedgerQueue = new Queue('drexdel-payment-ledger', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100, // Keep last 100 for debugging
        removeOnFail: 500,
      }
    });
  }
  return paymentLedgerQueue;
}

// Validation
export const checkoutSchema = z.object({
  eventId: z.string().cuid(),
  tierId: z.string().cuid(),
  quantity: z.number().int().min(1).max(10).default(1),
  amount: z.number().min(0),
  currency: z.enum(['RWF', 'USD', 'EUR']),
  paymentMethod: z.preprocess(
    (val) => typeof val === 'string' ? val.trim().toUpperCase() : val,
    z.enum(['CREDIT_CARD', 'PAYPAL', 'MTN_MOMO', 'AIRTEL_MONEY'])
  ),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  idempotencyKey: z.string().uuid().optional(), // Client-generated for retry safety
});

export class PaymentController {
  
  async handleCheckout(req: Request, res: Response): Promise<void> {
    try {
      const data = (req as any).validatedBody || checkoutSchema.parse(req.body);
      const userId = req.user!.sub;

      if (['CREDIT_CARD', 'PAYPAL'].includes(data.paymentMethod) && !data.customerEmail) {
        res.status(400).json({ success: false, message: 'Customer email is required for credit card and PayPal payments.' });
        return;
      }

      if (['MTN_MOMO', 'AIRTEL_MONEY'].includes(data.paymentMethod) && !data.customerPhone) {
        res.status(400).json({ success: false, message: 'Customer phone number is required for telecom payments.' });
        return;
      }

      const idempotencyKey = data.idempotencyKey || randomUUID();
      
      // Check for existing payment with this key
      const existing = await prisma.payment.findUnique({
        where: { idempotencyKey }
      });
      
      if (existing) {
        // Return cached result
        res.status(200).json({
          success: true,
          transactionId: existing.transactionId,
          status: existing.status,
          message: 'Payment request already processed.'
        });
        return;
      }

      // Verify event and tier exist + have inventory
      const tier = await prisma.ticketTier.findUnique({
        where: { id: data.tierId },
        include: { event: true }
      });

      if (!tier || !tier.isActive) {
        res.status(400).json({ success: false, message: 'Invalid ticket tier' });
        return;
      }

      if (tier.eventId !== data.eventId) {
        res.status(400).json({ success: false, message: 'Selected ticket tier does not belong to the requested event' });
        return;
      }

      if (tier.currency !== data.currency) {
        res.status(400).json({ success: false, message: 'Ticket tier currency mismatch' });
        return;
      }

      if (data.quantity !== 1) {
        res.status(400).json({ success: false, message: 'Multiple ticket checkout is not supported yet. Please purchase one ticket at a time.' });
        return;
      }

      const expectedAmount = Number(tier.price) * data.quantity;
      if (Number(data.amount) !== expectedAmount) {
        res.status(400).json({ success: false, message: 'Checkout amount does not match selected ticket tier price' });
        return;
      }

      const available = tier.totalAllocation - tier.ticketsSold;
      if (available < data.quantity) {
        res.status(400).json({ success: false, message: 'Not enough tickets available' });
        return;
      }

      const transactionId = `tx_${Date.now()}_${randomUUID().slice(0, 8)}`;

      // Create pending payment record
      await prisma.payment.create({
        data: {
          transactionId,
          eventId: data.eventId,
          userId,
          amount: data.amount,
          currency: data.currency,
          paymentMethod: data.paymentMethod as PaymentMethod,
          provider: this.mapProvider(data.paymentMethod),
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          status: PaymentStatus.PENDING,
          idempotencyKey,
          tierId: data.tierId,
        }
      });

      if (data.paymentMethod === 'CREDIT_CARD') {
        try {
          const intent = await cardGateway.createPaymentIntent({
            transactionId, eventId: data.eventId, userId, amount: data.amount,
            currency: data.currency, customerEmail: data.customerEmail,
          });
          await prisma.payment.update({ where: { transactionId }, data: { gatewayReference: intent.id } });
          res.status(201).json({ success: true, transactionId, paymentIntentClientSecret: intent.clientSecret, status: 'requires_payment_method' });
          return;
        } catch (stripeError: any) {
          await prisma.payment.update({ where: { transactionId }, data: { status: PaymentStatus.FAILED, errorMessage: stripeError.message } });
          res.status(502).json({ success: false, message: 'Unable to initialise card payment.' });
          return;
        }
      }

      // Enqueue for async processing
      try {
        await getPaymentQueue().add(`payment_${transactionId}`, {
          transactionId,
          eventId: data.eventId,
          tierId: data.tierId,
          userId,
          quantity: data.quantity,
          amount: data.amount,
          currency: data.currency,
          paymentMethod: data.paymentMethod,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
        });
      } catch (queueError: any) {
                  logger.error({ err: queueError }, 'Payment queue enqueue failed');
        await prisma.payment.update({
          where: { transactionId },
          data: {
            status: PaymentStatus.FAILED,
            gatewayReference: 'FAILED_JOB_ENQUEUE',
            errorMessage: 'Payment request could not be queued for processing.',
          }
        });
        res.status(502).json({
          success: false,
          message: 'Payment provider queue is unavailable. Please try again later.'
        });
        return;
      }

      res.status(202).json({
        success: true,
        transactionId,
        status: 'pending',
        message: 'Payment request accepted for processing.',
        checkStatusUrl: `/v1/payments/status/${transactionId}` // Frontend polls this
      });

    } catch (error: any) {
            logger.error({ err: error }, 'Checkout error');
      res.status(500).json({ success: false, message: error.message || 'Checkout failed' });
    }
  }

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const event = cardGateway.constructWebhookEvent(req.body as Buffer, req.headers['stripe-signature'] as string | undefined, STRIPE_WEBHOOK_SECRET);
      const intent = event.data?.object;
      const transactionId = intent?.metadata?.transactionId;
      if (!transactionId) {
        res.status(400).json({ error: 'Missing Drexdel transaction metadata' });
        return;
      }
      if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
        req.body = { externalId: transactionId, transactionId: intent.id, status: event.type === 'payment_intent.succeeded' ? 'SUCCESSFUL' : 'FAILED', reason: intent.last_payment_error?.message };
        await this.handleTelecomCallback(req, res);
        return;
      }
      res.status(200).json({ received: true });
    } catch (error) {
      res.status(400).json({ error: 'Invalid Stripe webhook signature' });
    }
  }

  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = String(req.params.transactionId || '');
      const userId = req.user!.sub;
      const userRole = req.user!.role;
      
      const payment = await prisma.payment.findUnique({
        where: { transactionId },
        select: {
          userId: true,
          status: true,
          amount: true,
          currency: true,
          gatewayReference: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!payment) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      // Only the payer or authorised staff/admin can view a transaction
      const isAuthorised = payment.userId === userId || ['STAFF', 'ADMIN'].includes(userRole);
      if (!isAuthorised) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Don't expose userId in the response
      const { userId: _ownerId, ...safePayment } = payment;
      res.status(200).json(safePayment);
      
    } catch (error) {
            logger.error({ err: error }, 'Failed to fetch payment status');
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  }

  async handleTelecomCallback(req: Request, res: Response): Promise<void> {
    // ALWAYS respond immediately to provider — don't let them timeout
    res.status(200).json({ status: 'RECEIVED' });

    try {
      // Verify webhook signature when a secret is configured.
      // This prevents forged callbacks from marking payments as successful
      // without a real provider confirmation.
      if (TELECOM_WEBHOOK_SECRET) {
        const signature = req.headers['x-webhook-signature'] as string | undefined;
        if (!signature) {
                    logger.warn({}, 'Webhook missing signature header');
          return;
        }

        const rawBody = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(JSON.stringify(req.body));

        const expected = createHmac('sha256', TELECOM_WEBHOOK_SECRET)
          .update(rawBody)
          .digest('hex');

        // Constant-time comparison to prevent timing attacks
        const received = signature.startsWith('sha256=') ? signature.slice(7) : signature;
        const a = Buffer.from(expected);
        const b = Buffer.from(received);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
                    logger.warn({}, 'Webhook invalid signature');
          return;
        }
      }

      let payload: any = req.body;
      if (Buffer.isBuffer(payload)) {
        try {
          payload = JSON.parse(payload.toString('utf8'));
        } catch (parseError) {
                    logger.warn({ err: parseError }, 'Webhook invalid JSON payload');
          return;
        }
      }

      if (!payload || typeof payload !== 'object') {
                logger.warn({}, 'Webhook invalid payload');
        return;
      }

      const internalTxId = payload.externalId || payload.reference;
      if (!internalTxId) {
                logger.warn({}, 'Webhook missing transaction reference');
        return;
      }

      const processedKey = `webhook:${internalTxId}`;
      const client = await getRedisClient();
      if (client) {
        const alreadyProcessed = await client.get(processedKey);
        if (alreadyProcessed) {
                  logger.info({ transactionId: internalTxId }, 'Webhook already processed');
          return;
        }
        await client.setEx(processedKey, 300, 'processing');
      } else {
                logger.warn({}, 'Redis unavailable for webhook dedup, processing without deduplication');
      }

      const executionStatus = payload.status;
      console.log(`[Webhook] Callback for ${internalTxId}: ${executionStatus}`);

      if (executionStatus !== 'SUCCESSFUL') {
        await prisma.payment.update({
          where: { transactionId: internalTxId },
          data: {
            status: PaymentStatus.FAILED,
            errorMessage: payload.reason || 'Provider reported failure',
            gatewayResponse: payload,
            webhookReceivedAt: new Date(),
            webhookPayload: payload,
          }
        });
        if (client) {
          await client.setEx(processedKey, 86400, 'failed'); // Cache longer for audit
        }
        return;
      }

      // Success path — atomic ticket creation
      const payment = await prisma.payment.findUnique({
        where: { transactionId: internalTxId }
      });

      if (!payment) {
        console.warn(`[Webhook] Payment not found: ${internalTxId}`);
        return;
      }

      // Validate callback amount/currency matches the original payment
      // to prevent forged callbacks with mismatched values.
      if (payload.amount !== undefined) {
        const callbackAmount = Number(payload.amount);
        const originalAmount = Number(payment.amount);
        if (callbackAmount !== originalAmount) {
          console.warn(`[Webhook] Amount mismatch for ${internalTxId}: callback=${callbackAmount}, expected=${originalAmount}`);
          return;
        }
      }
      if (payload.currency !== undefined && payload.currency !== payment.currency) {
        console.warn(`[Webhook] Currency mismatch for ${internalTxId}: callback=${payload.currency}, expected=${payment.currency}`);
        return;
      }

      // Atomically decrement inventory, create the ticket and mark the
      // payment COMPLETED. Shared with the PayPal worker path so every
      // successful payment method issues a ticket.
      const issued = await this.issueTicket(
        internalTxId,
        payload.transactionId || payload.reference,
        payload,
      );

      if (client) {
        await client.setEx(processedKey, 86400, issued ? 'completed' : 'failed');
      }

    } catch (error) {
      console.error('[Webhook] Processing error:', error);
      // Don't throw — webhook already responded
    }
  }

  /**
   * Atomically issue a ticket for a successful payment: decrement inventory,
   * create the cryptographic ticket, mark the payment COMPLETED, and enqueue
   * ticket delivery. Shared by webhook handlers (Stripe/telecom) and the
   * payment worker (PayPal) so every successful method issues a ticket.
   *
   * Returns true when the ticket exists (already-completed payments are a
   * no-op success for idempotency), false when issuance could not complete.
   */
  public async issueTicket(
    internalTxId: string,
    gatewayReference: string,
    gatewayResponse: any,
  ): Promise<boolean> {
    const payment = await prisma.payment.findUnique({
      where: { transactionId: internalTxId }
    });

    if (!payment) {
      console.warn(`[Ticket] Payment not found: ${internalTxId}`);
      return false;
    }

    // Idempotency: if the payment is already completed a ticket was issued.
    if (payment.status === PaymentStatus.COMPLETED) {
      return true;
    }

    if (!payment.tierId) {
      console.warn(`[Ticket] Payment ${internalTxId} has no tierId`);
      await prisma.payment.update({
        where: { transactionId: internalTxId },
        data: {
          status: PaymentStatus.FAILED,
          errorMessage: 'Missing ticket tier ID for payment',
        }
      });
      return false;
    }

    const tierId = payment.tierId;

    try {
      await prisma.$transaction(async (tx) => {
        // Lock inventory via a conditional update to prevent concurrent overbooking
        const tier = await tx.ticketTier.findUnique({
          where: { id: tierId }
        });

        if (!tier || !tier.isActive) {
          throw new Error('Invalid ticket tier');
        }

        const tierUpdate = await tx.ticketTier.updateMany({
          where: {
            id: tier.id,
            ticketsSold: { lt: tier.totalAllocation },
          },
          data: { ticketsSold: { increment: 1 } }
        });

        if (tierUpdate.count !== 1) {
          throw new Error('Inventory exhausted');
        }

        await tx.event.update({
          where: { id: payment.eventId },
          data: {
            ticketsSold: { increment: 1 },
            grossRevenue: { increment: payment.amount }
          }
        });

        const secretSeed = randomUUID();
        const ticketSignature = generateTicketSignature(
          {
            ticketId: internalTxId,
            userId: payment.userId,
            eventId: payment.eventId,
            tierId: tier.id,
          },
          secretSeed
        );

        const ticket = await tx.ticket.create({
          data: {
            transactionId: internalTxId,
            eventId: payment.eventId,
            userId: payment.userId,
            tierId: tier.id,
            cryptographicToken: secretSeed,
            qrCodeString: ticketSignature,
            status: 'BOOKED',
          }
        });

        await tx.payment.update({
          where: { transactionId: internalTxId },
          data: {
            status: PaymentStatus.COMPLETED,
            gatewayReference,
            gatewayResponse,
            webhookReceivedAt: new Date(),
            webhookPayload: gatewayResponse,
          }
        });

        // Enqueue ticket delivery to user device
        try {
          await getTicketQueue().add(`ticket_${ticket.id}`, {
            ticketId: ticket.id,
            userId: payment.userId,
            eventId: payment.eventId,
          });
        } catch (ticketQueueError: any) {
                    logger.error({ err: ticketQueueError, ticketId: ticket.id }, 'Ticket queue enqueue failed');
        }
      });

      return true;
    } catch (error) {
            logger.error({ err: error, transactionId: internalTxId }, 'Ticket issuance failed');
      return false;
    }
  }

  private mapProvider(method: string): string {
    const map: Record<string, string> = {
      'CREDIT_CARD': 'stripe',
      'PAYPAL': 'paypal',
      'MTN_MOMO': 'mtn_momo',
      'AIRTEL_MONEY': 'airtel_money'
    };
    return map[method] || method;
  }
}

function generateTicketSignature(payload: { ticketId: string; userId: string; eventId: string; tierId: string }, secretSeed: string) {
  const epochBlock = Math.floor(Date.now() / 1000 / 30);
  const base = `${payload.ticketId}:${payload.userId}:${payload.eventId}:${epochBlock}:${secretSeed}:DREXDEL_CORE_SYSTEM_SALT`;
  const hash = createHmac('sha256', secretSeed).update(base).digest('hex');
  return `DREXDEL_SECURE_AUTH_${hash}_${payload.tierId}`;
}

// Lazy ticket queue initialization
let ticketGenerationQueue: Queue | null = null;
function getTicketQueue(): Queue {
  if (!ticketGenerationQueue) {
    ticketGenerationQueue = new Queue('drexdel-ticket-generation', {
      connection: getRedisConnection(),
    });
  }
  return ticketGenerationQueue;
}

export const paymentController = new PaymentController();
