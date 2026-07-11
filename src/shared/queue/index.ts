import { createQueueConnection } from './queue.connection.js';
import { createPetEmbeddingQueue } from './pet-embedding.queue.js';

export const queueConnection = createQueueConnection();
export const petEmbeddingQueue = createPetEmbeddingQueue(queueConnection);
