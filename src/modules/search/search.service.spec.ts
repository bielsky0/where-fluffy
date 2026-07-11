import { createSearchService } from './search.service.js';
import { SearchRepository, ISearchResult } from './interfaces/search.interface.js';
import { EmbeddingProvider } from '../../shared/embedding/interfaces/embedding-provider.interface.js';

const buildSearchResult = (overrides: Partial<ISearchResult> = {}): ISearchResult => ({
  id: 'pet-1',
  name: 'Rex',
  species: 'dog',
  category: 'dog',
  location: { lat: 52.2297, lng: 21.0122 },
  ownerId: 'owner-1',
  status: 'missing',
  reward: 100,
  phone: '600100200',
  email: null,
  distinguishingMarks: null,
  photoUrl: null,
  photoUrls: [],
  city: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  similarity: 0.9,
  ...overrides,
});

describe('createSearchService', () => {
  let mockSearchRepository: jest.Mocked<SearchRepository>;
  let mockEmbeddingProvider: jest.Mocked<EmbeddingProvider>;

  beforeEach(() => {
    mockSearchRepository = { findSimilar: jest.fn() };
    mockEmbeddingProvider = { generateEmbedding: jest.fn() };
  });

  it('embeds the query, forwards the vector/limit to the repository, and maps results to DTOs', async () => {
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSearchRepository.findSimilar.mockResolvedValue([buildSearchResult()]);

    const service = createSearchService(mockSearchRepository, mockEmbeddingProvider);
    const results = await service.searchPets('friendly dog', 10);

    expect(mockEmbeddingProvider.generateEmbedding).toHaveBeenCalledWith('friendly dog');
    expect(mockSearchRepository.findSimilar).toHaveBeenCalledWith([0.1, 0.2, 0.3], 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'pet-1', similarity: 0.9 });
  });

  it('throws a 503 AppError when the embedding provider fails, without querying the repository', async () => {
    mockEmbeddingProvider.generateEmbedding.mockRejectedValue(new Error('model unavailable'));

    const service = createSearchService(mockSearchRepository, mockEmbeddingProvider);

    await expect(service.searchPets('friendly dog', 10)).rejects.toMatchObject({ statusCode: 503 });
    expect(mockSearchRepository.findSimilar).not.toHaveBeenCalled();
  });
});
