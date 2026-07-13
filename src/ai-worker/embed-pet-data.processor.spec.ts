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
  photoUrl: 'https://res.cloudinary.com/demo/pets/rex.webp',
  photoUrls: ['https://res.cloudinary.com/demo/pets/rex.webp'],
  city: null,
  sourceUrl: null,
  originalContact: null,
  isAdminAdded: false,
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
      clearEmbedding: jest.fn(),
      findByOwnerId: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      deleteById: jest.fn(),
      findSimilar: jest.fn(),
    };
    mockEmbeddingProvider = { generateEmbedding: jest.fn(), generateImageEmbedding: jest.fn() };
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger;
  });

  it('embeds the pet photos (vision-only) and writes the resulting vector', async () => {
    const photoUrls = [
      'https://res.cloudinary.com/demo/pets/rex-1.webp',
      'https://res.cloudinary.com/demo/pets/rex-2.webp',
    ];
    mockPetRepository.findById.mockResolvedValue(buildPet({ photoUrls }));
    mockEmbeddingProvider.generateImageEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockPetRepository.updateEmbedding.mockResolvedValue('updated');

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await process(buildJob('pet-1'));

    expect(mockEmbeddingProvider.generateImageEmbedding).toHaveBeenCalledWith(photoUrls);
    // Pola tekstowe celowo NIE wchodzą do embeddingu — pipeline jest vision-only.
    expect(mockEmbeddingProvider.generateEmbedding).not.toHaveBeenCalled();
    expect(mockPetRepository.updateEmbedding).toHaveBeenCalledWith('pet-1', [0.1, 0.2, 0.3]);
  });

  it('caps the embedded photos at the first 5', async () => {
    const photoUrls = Array.from({ length: 7 }, (_, i) => `https://res.cloudinary.com/demo/pets/rex-${i}.webp`);
    mockPetRepository.findById.mockResolvedValue(buildPet({ photoUrls }));
    mockEmbeddingProvider.generateImageEmbedding.mockResolvedValue([0.1]);
    mockPetRepository.updateEmbedding.mockResolvedValue('updated');

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await process(buildJob('pet-1'));

    expect(mockEmbeddingProvider.generateImageEmbedding).toHaveBeenCalledWith(photoUrls.slice(0, 5));
  });

  it('falls back to the single photoUrl when photoUrls is empty', async () => {
    mockPetRepository.findById.mockResolvedValue(
      buildPet({ photoUrls: [], photoUrl: 'https://res.cloudinary.com/demo/pets/solo.webp' }),
    );
    mockEmbeddingProvider.generateImageEmbedding.mockResolvedValue([0.5]);
    mockPetRepository.updateEmbedding.mockResolvedValue('updated');

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await process(buildJob('pet-1'));

    expect(mockEmbeddingProvider.generateImageEmbedding).toHaveBeenCalledWith([
      'https://res.cloudinary.com/demo/pets/solo.webp',
    ]);
  });

  it('clears the embedding (instead of writing one) when the pet has no photos', async () => {
    mockPetRepository.findById.mockResolvedValue(buildPet({ photoUrls: [], photoUrl: null }));
    mockPetRepository.clearEmbedding.mockResolvedValue('updated');

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await expect(process(buildJob('pet-1'))).resolves.toBeUndefined();

    expect(mockPetRepository.clearEmbedding).toHaveBeenCalledWith('pet-1');
    expect(mockEmbeddingProvider.generateImageEmbedding).not.toHaveBeenCalled();
    expect(mockPetRepository.updateEmbedding).not.toHaveBeenCalled();
  });

  it('skips silently (does not throw) when the pet no longer exists', async () => {
    mockPetRepository.findById.mockResolvedValue(null);

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);
    await expect(process(buildJob('missing-pet'))).resolves.toBeUndefined();

    expect(mockEmbeddingProvider.generateImageEmbedding).not.toHaveBeenCalled();
    expect(mockPetRepository.updateEmbedding).not.toHaveBeenCalled();
    expect(mockPetRepository.clearEmbedding).not.toHaveBeenCalled();
  });

  it('propagates an embedding-provider error uncaught so BullMQ retries the job', async () => {
    mockPetRepository.findById.mockResolvedValue(buildPet());
    mockEmbeddingProvider.generateImageEmbedding.mockRejectedValue(new Error('model unavailable'));

    const process = createEmbedPetDataProcessor(mockPetRepository, mockEmbeddingProvider, logger);

    await expect(process(buildJob('pet-1'))).rejects.toThrow('model unavailable');
    expect(mockPetRepository.updateEmbedding).not.toHaveBeenCalled();
  });
});
