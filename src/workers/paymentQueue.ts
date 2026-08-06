import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../config/db';
import { PaymentStatus } from '@prisma/client';
import { cardGateway, paypalGateway, mtnMoMoGateway, airtelGateway } from '../services/payment/gatewayFactory';
import { paymentController } from '../controllers/paymentController';

// Circuit breaker state
const circuitBreakers = new Map<string, { failures: number; lastFailure: number; open: boolean }>();

function isCircuitOpen(provider: string): boolean {
  const state = circuitBreakers.get(provider);
  if (!state || !state.open) return false;
  // Reset after 30 seconds
  if (Date.now() - state.lastFailure > 30000) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(provider: string) {
  const state = circuitBreakers.get(provider) || { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= 5) state.open = true;
  circuitBreakers.set(provider, state);
}

function recordSuccess(provider: string) {
  circuitBreakers.delete(provider);
}

export const paymentLedgerWorker = new Worker(
  'drexdel-payment-ledger',
  async (job: Job) => {
    const payload = job.data;
    console.log(`[PaymentWorker] Processing ${payload.transactionId}`);

    let gatewayResult;
    const provider = payload.paymentMethod.toLowerCase();

    if (isCircuitOpen(provider)) {
      throw new Error(`Circuit breaker open for ${provider}`);
    }

    try {
      switch (payload.paymentMethod) {
        case 'MTN_MOMO':
          gatewayResult = await mtnMoMoGateway.requestPayment(payload);
          break;
        case 'AIRTEL_MONEY':
          gatewayResult = await airtelGateway.collectPayment(payload);
          break;
        case 'CREDIT_CARD':
          throw new Error('Card payments must be confirmed through the Stripe Payment Intent flow.');
        case 'PAYPAL':
          gatewayResult = await paypalGateway.processPayment(payload);
          break;
        default:
          throw new Error(`Unsupported: ${payload.paymentMethod}`);
      }

      if (!gatewayResult.success) {
        recordFailure(provider);
        await prisma.payment.update({
          where: { transactionId: payload.transactionId },
          data: {
            status: PaymentStatus.FAILED,
            gatewayReference: gatewayResult.gatewayReference,
            errorMessage: gatewayResult.error,
          }
        });
        throw new Error(gatewayResult.error);
      }

      recordSuccess(provider);
      
      // Card payments are confirmed client-side via the Stripe PaymentSheet and
      // the ticket is issued by the Stripe webhook, so the worker never marks
      // them here. PayPal is a sync provider: issue the ticket immediately via
      // the shared atomic path so every successful method gets a ticket.
      if (payload.paymentMethod === 'PAYPAL') {
        await paymentController.issueTicket(
          payload.transactionId,
          gatewayResult.gatewayReference,
          gatewayResult,
        );
      }

    } catch (error: any) {
      console.error(`[PaymentWorker] Failed ${payload.transactionId}:`, error.message);
      throw error; // BullMQ will retry based on job options
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 20, // Start conservative, scale up with CPU
    limiter: {
      max: 100,
      duration: 1000,
    }
  }
);

paymentLedgerWorker.on('completed', (job) => {
  console.log(`[PaymentWorker] Completed ${job.id}`);
});

paymentLedgerWorker.on('failed', (job, err) => {
  console.error(`[PaymentWorker] Failed ${job?.id}:`, err.message);
});
