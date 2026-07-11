import 'dotenv/config';

import { Worker } from 'bullmq';
import { EMBED_PET_DATA_JOB_NAME } from '../shared/queue/jobs/embed-pet-data.job.js';
import { processEmbedPetData, queueConnection } from './index.js';
import { prisma } from '../shared/prisma.js';
import { logger } from '../shared/infrastructure/logger.js';

const worker = new Worker(EMBED_PET_DATA_JOB_NAME, processEmbedPetData, {
  connection: queueConnection,
  concurrency: Number(process.env.AI_WORKER_CONCURRENCY ?? 2),
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'job completed');
});

worker.on('failed', (job, err) => {
  const exhausted = job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);
  if (exhausted) {
    logger.error({ jobId: job?.id, petId: job?.data?.petId, err }, '[CRITICAL_AI_ERROR] job permanently failed');
  } else {
    logger.warn({ jobId: job?.id, attemptsMade: job?.attemptsMade, err }, 'job attempt failed, will retry');
  }
});

logger.info('[BOOTSTRAP] ai-worker nasłuchuje na kolejce EMBED_PET_DATA...');

// Kolejność jak main.ts: zamknij konsumenta -> rozłącz bazę -> zamknij połączenie kolejki, żeby
// nie zostawić otwartych uchwytów blokujących wyjście procesu po SIGTERM/SIGINT.
const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, '[SHUTDOWN] ai-worker zamyka się...');
  try {
    await worker.close();
    await prisma.$disconnect();
    await queueConnection.quit();
    logger.info('[SHUTDOWN] Zamknięto czysto.');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '[SHUTDOWN] Błąd podczas zamykania');
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
