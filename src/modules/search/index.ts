import { prisma } from '../../shared/prisma.js';
import { createEmbeddingProvider } from '../../shared/embedding/embedding-provider.factory.js';
import { createSearchRepository } from './search.repository.js';
import { createSearchService } from './search.service.js';
import { createSearchController } from './search.controller.js';

export const searchEmbeddingProvider = createEmbeddingProvider();
export const searchRepository = createSearchRepository(prisma);
export const searchService = createSearchService(searchRepository, searchEmbeddingProvider);
export const searchController = createSearchController(searchService);
