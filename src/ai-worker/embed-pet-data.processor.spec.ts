import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { createEmbedPetDataProcessor } from './embed-pet-data.processor.js';
import { IPet, PetRepository } from '../modules/pets/interfaces/pets.interface.js';
import { EmbeddingProvider } from '../shared/embedding/interfaces/embedding-provider.interface.js';

const buildPet = (overrides: Partial<IPet> = {}): IPet => ({
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
  distinguishingMarks: 'Biała łatka na łapie',
  photoUrl: null,
  photoUrls: [],
  city: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  ...overrides,
});

const buildJob = (petId: string, id = '1'): Job => ({ id, data: { petId } }) as unknown as Job;

describe('createEmbedPetDataProcessor', () => {
  let mockPetRepository: jest.Mocked<PetRepository>;
  let mockEmbeddingProvider: jest.Mocked<EmbeddingProvider>;
  let logger: Logger;

  beforeEach(() => {
    mockPetRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findNearLocation: jest.fn(),
      updateEmbedding: jest.fn(),
      findByOwnerId: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      deleteById: jest.fn(),
      findSimilar: jest.fn(),
    };
    mockEmbeddingProvider = { generateEmbedding: jest.fn() };
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger;
  });

  it('builds the embedding input from name/species/category/distinguishingMarks and writes the resulting vector', async () => {
    mockPetRepository.findById.mockResolvedValue(buildPet());
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockPetRepository.updateEmbedding.mockResolvedValue('updated');

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await process(buildJob('pet-1'));

    expect(mockEmbeddingProvider.generateEmbedding).toHaveBeenCalledWith(
      'Rex. dog. dog. Biała łatka na łapie',
    );
    expect(mockPetRepository.updateEmbedding).toHaveBeenCalledWith('pet-1', [0.1, 0.2, 0.3]);
  });

  it('omits falsy fields (null name/distinguishingMarks) from the embedding input', async () => {
    mockPetRepository.findById.mockResolvedValue(buildPet({ name: null, distinguishingMarks: null }));
    mockEmbeddingProvider.generateEmbedding.mockResolvedValue([0.1]);
    mockPetRepository.updateEmbedding.mockResolvedValue('updated');

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await process(buildJob('pet-1'));

    expect(mockEmbeddingProvider.generateEmbedding).toHaveBeenCalledWith('dog. dog');
  });

  it('skips silently (does not throw) when the pet no longer exists', async () => {
    mockPetRepository.findById.mockResolvedValue(null);

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await expect(process(buildJob('missing-pet'))).resolves.toBeUndefined();

    expect(mockEmbeddingProvider.generateEmbedding).not.toHaveBeenCalled();
    expect(mockPetRepository.updateEmbedding).not.toHaveBeenCalled();
  });

  it('propagates an embedding-provider error uncaught so BullMQ retries the job', async () => {
    mockPetRepository.findById.mockResolvedValue(buildPet());
    mockEmbeddingProvider.generateEmbedding.mockRejectedValue(new Error('model unavailable'));

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);

    await expect(process(buildJob('pet-1'))).rejects.toThrow('model unavailable');
    expect(mockPetRepository.updateEmbedding).not.toHaveBeenCalled();
  });
});
