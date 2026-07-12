import express, { Express } from 'express';
import request from 'supertest';
import { createSearchService, SearchService } from './search.service.js';
import { createSearchController } from './search.controller.js';
import { SearchRepository } from './interfaces/search.interface.js';
import { EmbeddingProvider } from '../../shared/embedding/interfaces/embedding-provider.interface.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { searchPetsQuerySchema } from './search.schema.js';

// Minimalna, samodzielna apka Express — tylko trasa /search/pets, serwis/kontroler prawdziwe
// zbudowane na mockowanym SearchRepository/EmbeddingProvider, ta sama konwencja co
// comments.controller.spec.ts.
const buildTestApp = (searchService: SearchService): Express => {
  const controller = createSearchController(searchService);

  const app = express();
  app.get('/search/pets', validateQuery(searchPetsQuerySchema), asyncHandler(controller.searchPets));
  app.use(errorHandler);
  return app;
};

describe('search controller (via supertest)', () => {
  let mockSearchRepository: jest.Mocked<SearchRepository>;
  let mockEmbeddingProvider: jest.Mocked<EmbeddingProvider>;
  let app: Express;

  beforeEach(() => {
    mockSearchRepository = { findSimilar: jest.fn() };
    mockEmbeddingProvider = { generateEmbedding: jest.fn() };
    app = buildTestApp(createSearchService(mockSearchRepository, mockEmbeddingProvider));
  });

  describe('GET /search/pets', () => {
    it('returns 200 with mapped results for a valid query', async () => {
      mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      mockSearchRepository.findSimilar.mockResolvedValue([
        {
          id: 'pet-1',
          name: 'Rex',
          species: 'dog',
          category: 'dog',
          location: { lat: 52.2297, lng: 21.0122 },
          ownerId: 'owner-1',
          status: 'missing',
          reward: 0,
          phone: null,
          email: null,
          distinguishingMarks: null,
          photoUrl: null,
          photoUrls: [],
          city: null,
          sourceUrl: null,
          originalContact: null,
          isAdminAdded: false,
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
          updatedAt: new Date('2026-01-01T10:00:00.000Z'),
          similarity: 0.87,
        },
      ]);

      const response = await request(app).get('/search/pets').query({ q: 'friendly dog' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ id: 'pet-1', similarity: 0.87 });
      expect(mockEmbeddingProvider.generateEmbedding).toHaveBeenCalledWith('friendly dog');
      expect(mockSearchRepository.findSimilar).toHaveBeenCalledWith([0.1, 0.2], 10);
    });

    it('defaults limit to 10 and forwards an explicit limit when given', async () => {
      mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1]);
      mockSearchRepository.findSimilar.mockResolvedValue([]);

      await request(app).get('/search/pets').query({ q: 'cat', limit: '5' });

      expect(mockSearchRepository.findSimilar).toHaveBeenCalledWith([0.1], 5);
    });

    it('returns 400 with Zod validation details when q is missing', async () => {
      const response = await request(app).get('/search/pets');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(mockEmbeddingProvider.generateEmbedding).not.toHaveBeenCalled();
    });

    it('returns 503 when the embedding provider fails', async () => {
      mockEmbeddingProvider.generateEmbedding.mockRejectedValue(new Error('model unavailable'));

      const response = await request(app).get('/search/pets').query({ q: 'friendly dog' });

      expect(response.status).toBe(503);
    });
  });
});
