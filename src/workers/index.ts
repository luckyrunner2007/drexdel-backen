import { disconnectDB } from '../config/db';
import { validateRuntimeEnv } from '../config/env';
import { logger } from '../config/logger';
import { paymentLedgerWorker } from './paymentQueue';
import { ticketGenerationWorker } from './ticketWorker';

validateRuntimeEnv();

const workers = [paymentLedgerWorker, ticketGenerationWorker];
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Stopping Drexdel workers');

  try {
    await Promise.all(workers.map((worker) => worker.close()));
    await disconnectDB();
    logger.info('Drexdel workers stopped');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Worker shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught worker exception');
  void shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled worker rejection');
});

logger.info({ workers: ['drexdel-payment-ledger', 'drexdel-ticket-generation'] }, 'Drexdel workers started');
