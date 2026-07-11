import { EmbeddingProvider } from '../../shared/embedding/interfaces/embedding-provider.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { SearchResultDTO } from './dto/search-result.dto.js';
import { SearchRepository } from './interfaces/search.interface.js';
import { mapToSearchResultDTO } from './search.mapper.js';

export type SearchService = {
  searchPets: (query: string, limit: number) => Promise<SearchResultDTO[]>;
};

export const createSearchService = (
  searchRepository: SearchRepository,
  embeddingProvider: EmbeddingProvider,
): SearchService => {
  const searchPets: SearchService['searchPets'] = async (query, limit) => {
    let queryVector: number[];

    try {
      queryVector = await embeddingProvider.generateEmbedding(query);
    } catch (err) {
      // embeddingProvider już zalogował [CRITICAL_AI_ERROR] z długością tekstu (patrz
      // local-embedding.provider.ts) — tutaj dodajemy kontekst zapytania i mapujemy na 503,
      // zamiast dawać kłamliwe 500 (wyszukiwanie jest po prostu chwilowo niedostępne).
      logger.error({ err, query }, '[CRITICAL_AI_ERROR] query-time embedding failed');
      throw createAppError(503, 'Wyszukiwanie semantyczne jest chwilowo niedostępne');
    }

    const results = await searchRepository.findSimilar(queryVector, limit);
    return results.map(mapToSearchResultDTO);
  };

  return { searchPets };
};
