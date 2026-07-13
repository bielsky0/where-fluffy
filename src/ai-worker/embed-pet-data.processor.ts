import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { PetRepository } from '../modules/pets/interfaces/pets.interface.js';
import { EmbeddingProvider } from '../shared/embedding/interfaces/embedding-provider.interface.js';
import { EmbedPetDataPayload } from '../shared/queue/jobs/embed-pet-data.job.js';

// Pipeline jest vision-only (pola tekstowe nie wchodzą do wektora) — górna granica liczby zdjęć
// musi zgadzać się z MAX_IMAGES_PER_REQUEST w sidecarze (infra/ai-model/main.py).
const MAX_EMBED_PHOTOS = 5;

export const createEmbedPetDataProcessor = (
  petsRepository: PetRepository,
  embeddingProvider: EmbeddingProvider,
  logger: Logger,
) => {
  const processEmbedPetData = async (job: Job<EmbedPetDataPayload>): Promise<void> => {
    const { petId } = job.data;

    // Zawsze pobieramy świeży stan z bazy, nigdy nie ufamy danym z payloadu zadania — to
    // właśnie czyni powtórne edycje idempotentnymi (ostatnie zadanie, które się wykona, wygrywa).
    const pet = await petsRepository.findById(petId);
    if (!pet) {
      // Uzasadniony race (zwierzak usunięty między enqueue a przetworzeniem), nie błąd — nie
      // rzucamy, żeby BullMQ nie próbował ponawiać zadania dla czegoś, co nigdy się nie uda.
      logger.warn({ jobId: job.id, petId }, 'pet no longer exists, skipping embedding');
      return;
    }

    const photoUrls = (pet.photoUrls.length > 0 ? pet.photoUrls : pet.photoUrl ? [pet.photoUrl] : [])
      .slice(0, MAX_EMBED_PHOTOS);

    if (photoUrls.length === 0) {
      // Vision-only: bez zdjęć nie ma z czego liczyć wektora. Czyścimy ewentualny stary embedding
      // (np. tekstowy sprzed migracji na vision albo po usunięciu wszystkich zdjęć w edycji) —
      // zostawienie go kłamałoby w wynikach wyszukiwania.
      const result = await petsRepository.clearEmbedding(petId);
      logger.warn({ jobId: job.id, petId, result }, 'pet has no photos, embedding cleared');
      return;
    }

    // Sidecar zwraca JEDEN gotowy (spoolowany, znormalizowany) wektor za cały zestaw zdjęć —
    // worker nie wykonuje żadnej arytmetyki na wektorach (patrz embedding-provider.interface.ts).
    // Może rzucić (embeddingProvider już wyczerpał własne szybkie retry) — celowo nie łapiemy
    // tutaj, żeby BullMQ's attempts/backoff (ustawione przy queue.add w pet-embedding.queue.ts)
    // przejęło kontrolę nad tym zadaniem.
    const vector = await embeddingProvider.generateImageEmbedding(photoUrls);

    const result = await petsRepository.updateEmbedding(petId, vector);
    logger.info({ jobId: job.id, petId, photoCount: photoUrls.length, result }, 'embedding written');
  };

  return processEmbedPetData;
};
