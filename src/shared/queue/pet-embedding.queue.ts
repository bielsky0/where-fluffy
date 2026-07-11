import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { EMBED_PET_DATA_JOB_NAME, EmbedPetDataPayload } from './jobs/embed-pet-data.job.js';

export type PetEmbeddingQueue = {
  enqueueEmbedPetData: (petId: string) => Promise<void>;
  close: () => Promise<void>;
};

export const createPetEmbeddingQueue = (connection: Redis): PetEmbeddingQueue => {
  const queue = new Queue(EMBED_PET_DATA_JOB_NAME, { connection });

  const enqueueEmbedPetData: PetEmbeddingQueue['enqueueEmbedPetData'] = async (petId) => {
    const payload: EmbedPetDataPayload = { petId };
    await queue.add(EMBED_PET_DATA_JOB_NAME, payload, {
      // Job-level retry (coarse, spaced-out attempts) — separate from
      // local-embedding.provider.ts's own fast in-call retries, which absorb a single transient
      // blip within one attempt. This handles the case where ai-model is genuinely down/cold.
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      // Keep failed jobs visible (not auto-removed) — this is the only visibility into
      // permanently-failed embedding jobs until the reconciliation-sweep follow-up exists.
      removeOnFail: false,
    });
  };

  const close = () => queue.close();

  return { enqueueEmbedPetData, close };
};
