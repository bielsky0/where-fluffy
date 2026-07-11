import { prisma } from '../shared/prisma.js';
import { createPetRepository } from '../modules/pets/pets.repository.js';
import { createEmbeddingProvider } from '../shared/embedding/embedding-provider.factory.js';
import { createQueueConnection } from '../shared/queue/queue.connection.js';
import { logger } from '../shared/infrastructure/logger.js';
import { createEmbedPetDataProcessor } from './embed-pet-data.processor.js';

// Ten sam prisma singleton co api, ale w praktyce zawsze osobna instancja PrismaClient/połączenie
// — ai-worker działa w osobnym procesie/kontenerze, więc stan modułu Node (w tym prisma.ts's
// `new PrismaClient()`) jest z natury odrębny per proces, bez dodatkowego kodu.
export const petsRepository = createPetRepository(prisma);
export const embeddingProvider = createEmbeddingProvider();
export const queueConnection = createQueueConnection();
export const processEmbedPetData = createEmbedPetDataProcessor(petsRepository, embeddingProvider, logger);
