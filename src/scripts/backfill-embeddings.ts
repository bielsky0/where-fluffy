// Jednorazowy backfill po migracji na embeddingi vision-only: wrzuca do kolejki zadanie
// EMBED_PET_DATA dla KAŻDEGO zwierzaka. Celowo nie liczy niczego samodzielnie — reużywa całego
// idempotentnego pipeline'u workera (worker sam pobiera świeży stan; zwierzaki ze zdjęciami
// dostają nowy wektor wizyjny, zwierzaki bez zdjęć mają czyszczony stary wektor tekstowy —
// patrz ai-worker/embed-pet-data.processor.ts; retry ma BullMQ). Tempo przetwarzania ogranicza
// AI_WORKER_CONCURRENCY + semafor inferencji w sidecarze, więc rozmiar kolejki nie przekłada
// się na skok RAM po stronie ai-model.
//
// Uruchomienie (z katalogu src/, z ustawionymi DATABASE_URL i REDIS_URL; ai-worker musi działać,
// żeby kolejka się opróżniła):
//   npx tsx scripts/backfill-embeddings.ts
import { prisma } from '../shared/prisma.js';
import { createQueueConnection } from '../shared/queue/queue.connection.js';
import { createPetEmbeddingQueue } from '../shared/queue/pet-embedding.queue.js';
import { logger } from '../shared/infrastructure/logger.js';

const BATCH_SIZE = 500;

const main = async () => {
  const queueConnection = createQueueConnection();
  const petEmbeddingQueue = createPetEmbeddingQueue(queueConnection);

  let enqueued = 0;
  let cursor: string | undefined;

  // Paginacja keyset po id zamiast findMany() bez limitu — nie wciąga całej tabeli do pamięci.
  for (;;) {
    const pets = await prisma.pet.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
    });
    if (pets.length === 0) break;

    for (const pet of pets) {
      await petEmbeddingQueue.enqueueEmbedPetData(pet.id);
      enqueued++;
    }
    cursor = pets[pets.length - 1]!.id;
    logger.info({ enqueued }, 'backfill: batch enqueued');
  }

  logger.info({ enqueued }, 'backfill: all embedding jobs enqueued');

  await petEmbeddingQueue.close();
  await queueConnection.quit();
  await prisma.$disconnect();
};

main().catch((err) => {
  logger.error({ err }, 'backfill failed');
  process.exitCode = 1;
});
