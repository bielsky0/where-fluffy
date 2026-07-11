import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { PetRepository } from '../modules/pets/interfaces/pets.interface.js';
import { EmbeddingProvider } from '../shared/embedding/interfaces/embedding-provider.interface.js';
import { EmbedPetDataPayload } from '../shared/queue/jobs/embed-pet-data.job.js';

export const createEmbedPetDataProcessor = (
  petsRepository: PetRepository,
  embeddingProvider: EmbeddingProvider,
  logger: Logger,
) => {
  const processEmbedPetData = async (job: Job<EmbedPetDataPayload>): Promise<void> => {
    const { petId } = job.data;

    // Zawsze pobieramy świeży stan z bazy, nigdy nie ufamy tekstowi z payloadu zadania — to
    // właśnie czyni powtórne edycje idempotentnymi (ostatnie zadanie, które się wykona, wygrywa).
    const pet = await petsRepository.findById(petId);
    if (!pet) {
      // Uzasadniony race (zwierzak usunięty między enqueue a przetworzeniem), nie błąd — nie
      // rzucamy, żeby BullMQ nie próbował ponawiać zadania dla czegoś, co nigdy się nie uda.
      logger.warn({ jobId: job.id, petId }, 'pet no longer exists, skipping embedding');
      return;
    }

    const embeddingInput = [pet.name, pet.species, pet.category, pet.distinguishingMarks]
      .filter((value): value is string => Boolean(value))
      .join('. ');

    // Może rzucić (embeddingProvider już wyczerpał własne szybkie retry) — celowo nie łapiemy
    // tutaj, żeby BullMQ's attempts/backoff (ustawione przy queue.add w pet-embedding.queue.ts)
    // przejęło kontrolę nad tym zadaniem.
    const vector = await embeddingProvider.generateEmbedding(embeddingInput);

    const result = await petsRepository.updateEmbedding(petId, vector);
    logger.info({ jobId: job.id, petId, result }, 'embedding written');
  };

  return processEmbedPetData;
};
