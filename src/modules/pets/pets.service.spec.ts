import { createPetsService } from './pets.service.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { ImageStorageProvider } from '../../shared/photo/image-storage.interface.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';
import { PetEmbeddingQueue } from '../../shared/queue/pet-embedding.queue.js';

const buildPet = (overrides: Partial<IPet> = {}): IPet => ({
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
  sourceUrl: null,
  originalContact: null,
  isAdminAdded: false,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

const buildCreateDto = (overrides: Partial<CreatePetDTO> = {}): CreatePetDTO => ({
  name: 'Rex',
  species: 'dog',
  status: 'missing',
  location: { lat: 52.2297, lng: 21.0122 },
  reward: 100,
  phone: '600100200',
  photoBase64s: [],
  ownerId: 'owner-1',
  ...overrides,
});

describe('createPetsService', () => {
  let mockRepository: jest.Mocked<PetRepository>;
  let mockImageStorageProvider: jest.Mocked<ImageStorageProvider>;
  let mockGeocodingService: jest.Mocked<GeocodingService>;
  let mockPetEmbeddingQueue: jest.Mocked<PetEmbeddingQueue>;

  beforeEach(() => {
    mockRepository = {
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
    mockImageStorageProvider = {
      upload: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockGeocodingService = {
      reverseGeocode: jest.fn().mockResolvedValue(null),
    };
    mockPetEmbeddingQueue = {
      enqueueEmbedPetData: jest.fn(),
      close: jest.fn(),
    };
  });

  describe('reportMissingPet', () => {
    it('passes the DTO through to repository.save with a server-computed category', async () => {
      const dto = buildCreateDto();
      const { photoBase64s: _photoBase64s, ...restDto } = dto;
      mockRepository.save.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(dto);

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...restDto,
        category: 'dog',
        photoUrl: undefined,
        photoUrls: [],
        city: null,
      });
    });

    it('passes sourceUrl/originalContact/isAdminAdded through to repository.save unchanged (Content Seeding)', async () => {
      const dto = buildCreateDto({
        sourceUrl: 'https://facebook.com/groups/example/posts/123',
        originalContact: 'Jan Kowalski, 600 100 200',
        isAdminAdded: true,
      });
      mockRepository.save.mockResolvedValue(buildPet({ isAdminAdded: true }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(dto);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceUrl: 'https://facebook.com/groups/example/posts/123',
          originalContact: 'Jan Kowalski, 600 100 200',
          isAdminAdded: true,
        }),
      );
    });

    it('categorizes the pet from its species before saving', async () => {
      const dto = buildCreateDto({ species: 'Kot europejski' });
      mockRepository.save.mockResolvedValue(buildPet({ category: 'cat' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(dto);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'cat', photoUrl: undefined, photoUrls: [] }),
      );
    });

    it('uploads each photo via ImageStorageProvider and threads the returned URLs into repository.save', async () => {
      const dto = buildCreateDto({
        photoBase64s: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      });
      mockImageStorageProvider.upload.mockResolvedValueOnce('data:image/jpeg;base64,AAA');
      mockImageStorageProvider.upload.mockResolvedValueOnce('data:image/jpeg;base64,BBB');
      mockRepository.save.mockResolvedValue(buildPet({ photoUrl: 'data:image/jpeg;base64,AAA' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(dto);

      expect(mockImageStorageProvider.upload).toHaveBeenCalledTimes(2);
      expect(mockImageStorageProvider.upload).toHaveBeenNthCalledWith(1, 'data:image/jpeg;base64,AAA');
      expect(mockImageStorageProvider.upload).toHaveBeenNthCalledWith(2, 'data:image/jpeg;base64,BBB');
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          photoUrl: 'data:image/jpeg;base64,AAA',
          photoUrls: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
        }),
      );
    });

    it('skips uploading via ImageStorageProvider entirely when no photos were submitted', async () => {
      mockRepository.save.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(buildCreateDto());

      expect(mockImageStorageProvider.upload).not.toHaveBeenCalled();
    });

    it('maps the saved domain pet into a PetResponseDTO', async () => {
      const savedPet = buildPet({ id: 'pet-99', reward: 250 });
      mockRepository.save.mockResolvedValue(savedPet);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.reportMissingPet(buildCreateDto());

      expect(result).toEqual({
        id: 'pet-99',
        name: savedPet.name,
        species: savedPet.species,
        category: savedPet.category,
        status: savedPet.status,
        ownerId: savedPet.ownerId,
        reward: 250,
        phone: savedPet.phone,
        email: savedPet.email,
        distinguishingMarks: savedPet.distinguishingMarks,
        photoUrl: savedPet.photoUrl,
        photoUrls: savedPet.photoUrls,
        city: savedPet.city,
        sourceUrl: savedPet.sourceUrl,
        originalContact: savedPet.originalContact,
        isAdminAdded: savedPet.isAdminAdded,
        location: savedPet.location,
        createdAt: savedPet.createdAt.toISOString(),
      });
    });

    it('propagates a rejection from repository.save without swallowing it', async () => {
      mockRepository.save.mockRejectedValue(new Error('DB failure'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.reportMissingPet(buildCreateDto())).rejects.toThrow('DB failure');
    });

    it('reverse-geocodes the DTO location and threads the resulting city into repository.save', async () => {
      const dto = buildCreateDto({ location: { lat: 52.2297, lng: 21.0122 } });
      mockGeocodingService.reverseGeocode.mockResolvedValue('Warszawa');
      mockRepository.save.mockResolvedValue(buildPet({ city: 'Warszawa' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(dto);

      expect(mockGeocodingService.reverseGeocode).toHaveBeenCalledWith(52.2297, 21.0122);
      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ city: 'Warszawa' }));
    });

    it('saves the pet with city null when geocoding resolves null, without failing the request', async () => {
      mockGeocodingService.reverseGeocode.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.reportMissingPet(buildCreateDto())).resolves.toBeDefined();

      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ city: null }));
    });

    it('omits name from the saved record when reporting a found pet without one', async () => {
      const dto = buildCreateDto({ status: 'found', name: undefined, reward: 0 });
      mockRepository.save.mockResolvedValue(buildPet({ name: null, status: 'found' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(dto);

      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ name: undefined }));
    });

    it('enqueues an EMBED_PET_DATA job for the saved pet after repository.save succeeds', async () => {
      const savedPet = buildPet({ id: 'pet-42' });
      mockRepository.save.mockResolvedValue(savedPet);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.reportMissingPet(buildCreateDto());

      expect(mockPetEmbeddingQueue.enqueueEmbedPetData).toHaveBeenCalledWith('pet-42');
    });

    it('does not fail the request when enqueueing the embedding job throws', async () => {
      mockRepository.save.mockResolvedValue(buildPet({ id: 'pet-42' }));
      mockPetEmbeddingQueue.enqueueEmbedPetData.mockRejectedValue(new Error('redis unavailable'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.reportMissingPet(buildCreateDto())).resolves.toBeDefined();
    });
  });

  describe('getPetsNearby', () => {
    it('passes lat/lng/radius through to repository.findNearLocation and maps the results', async () => {
      const nearbyPet = buildPet({ id: 'pet-2' });
      mockRepository.findNearLocation.mockResolvedValue([nearbyPet]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.getPetsNearby(52.2297, 21.0122, 1000);

      expect(mockRepository.findNearLocation).toHaveBeenCalledWith(52.2297, 21.0122, 1000);
      expect(result).toEqual([
        {
          id: 'pet-2',
          name: nearbyPet.name,
          species: nearbyPet.species,
          category: nearbyPet.category,
          status: nearbyPet.status,
          ownerId: nearbyPet.ownerId,
          reward: nearbyPet.reward,
          phone: nearbyPet.phone,
          email: nearbyPet.email,
          distinguishingMarks: nearbyPet.distinguishingMarks,
          photoUrl: nearbyPet.photoUrl,
          photoUrls: nearbyPet.photoUrls,
          city: nearbyPet.city,
          sourceUrl: nearbyPet.sourceUrl,
          originalContact: nearbyPet.originalContact,
          isAdminAdded: nearbyPet.isAdminAdded,
          location: nearbyPet.location,
          createdAt: nearbyPet.createdAt.toISOString(),
        },
      ]);
    });

    it('defaults radius to 5000 when not provided', async () => {
      mockRepository.findNearLocation.mockResolvedValue([]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.getPetsNearby(52.2297, 21.0122);

      expect(mockRepository.findNearLocation).toHaveBeenCalledWith(52.2297, 21.0122, 5000);
    });

    it('returns an empty array, not null/undefined, when the repository finds nothing', async () => {
      mockRepository.findNearLocation.mockResolvedValue([]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.getPetsNearby(52.2297, 21.0122);

      expect(result).toEqual([]);
    });

    it('propagates a rejection from repository.findNearLocation without swallowing it', async () => {
      mockRepository.findNearLocation.mockRejectedValue(new Error('DB failure'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.getPetsNearby(52.2297, 21.0122)).rejects.toThrow('DB failure');
    });
  });

  describe('getPetById', () => {
    it('maps the found pet into a PetResponseDTO', async () => {
      const pet = buildPet({ id: 'pet-7' });
      mockRepository.findById.mockResolvedValue(pet);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.getPetById('pet-7');

      expect(mockRepository.findById).toHaveBeenCalledWith('pet-7');
      expect(result.id).toBe('pet-7');
    });

    it('throws a 404 AppError when the pet does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.getPetById('missing-id')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Zgłoszenie zwierzaka nie istnieje',
      });
    });
  });

  describe('getPetsByOwner', () => {
    it('passes ownerId through to repository.findByOwnerId and maps the results', async () => {
      const pet = buildPet({ id: 'pet-3', ownerId: 'owner-9' });
      mockRepository.findByOwnerId.mockResolvedValue([pet]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.getPetsByOwner('owner-9');

      expect(mockRepository.findByOwnerId).toHaveBeenCalledWith('owner-9');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pet-3');
    });
  });

  describe('updatePet', () => {
    it('throws 404 when the pet does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.updatePet('missing-id', 'owner-1', {})).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 403 when the requester is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.updatePet('pet-1', 'someone-else', { name: 'X' })).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('recomputes category when species changes', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1', species: 'dog', category: 'dog' }));
      mockRepository.update.mockResolvedValue(buildPet({ species: 'Kot europejski', category: 'cat' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.updatePet('pet-1', 'owner-1', { species: 'Kot europejski' });

      expect(mockRepository.update).toHaveBeenCalledWith(
        'pet-1',
        expect.objectContaining({ species: 'Kot europejski', category: 'cat' }),
      );
    });

    it('reuses already-stored photo URLs and only stores genuinely new ones, preserving client order', async () => {
      mockRepository.findById.mockResolvedValue(
        buildPet({ ownerId: 'owner-1', photoUrls: ['existing-a', 'existing-b'] }),
      );
      mockImageStorageProvider.upload.mockResolvedValue('stored-new');
      mockRepository.update.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.updatePet('pet-1', 'owner-1', { photoBase64s: ['existing-b', 'existing-a', 'brand-new'] });

      expect(mockImageStorageProvider.upload).toHaveBeenCalledTimes(1);
      expect(mockImageStorageProvider.upload).toHaveBeenCalledWith('brand-new');
      expect(mockRepository.update).toHaveBeenCalledWith(
        'pet-1',
        expect.objectContaining({
          photoUrls: ['existing-b', 'existing-a', 'stored-new'],
          photoUrl: 'existing-b',
        }),
      );
      expect(mockImageStorageProvider.remove).not.toHaveBeenCalled();
    });

    it('removes photos dropped from the client-submitted array from storage after a successful update', async () => {
      mockRepository.findById.mockResolvedValue(
        buildPet({ ownerId: 'owner-1', photoUrls: ['existing-a', 'existing-b', 'existing-c'] }),
      );
      mockRepository.update.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.updatePet('pet-1', 'owner-1', { photoBase64s: ['existing-b'] });

      expect(mockImageStorageProvider.remove).toHaveBeenCalledTimes(2);
      expect(mockImageStorageProvider.remove).toHaveBeenCalledWith('existing-a');
      expect(mockImageStorageProvider.remove).toHaveBeenCalledWith('existing-c');
    });

    it('does not fail the update when removing a dropped photo from storage rejects', async () => {
      mockRepository.findById.mockResolvedValue(
        buildPet({ ownerId: 'owner-1', photoUrls: ['existing-a', 'existing-b'] }),
      );
      mockRepository.update.mockResolvedValue(buildPet());
      mockImageStorageProvider.remove.mockRejectedValue(new Error('cloudinary unavailable'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(
        service.updatePet('pet-1', 'owner-1', { photoBase64s: ['existing-b'] }),
      ).resolves.toBeDefined();
    });

    it('re-enqueues the embedding job when name changes', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1', name: 'Rex' }));
      mockRepository.update.mockResolvedValue(buildPet({ name: 'Max' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.updatePet('pet-1', 'owner-1', { name: 'Max' });

      expect(mockPetEmbeddingQueue.enqueueEmbedPetData).toHaveBeenCalledWith('pet-1');
    });

    it('does not re-enqueue the embedding job for embedding-irrelevant changes only', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1', reward: 100 }));
      mockRepository.update.mockResolvedValue(buildPet({ reward: 500 }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.updatePet('pet-1', 'owner-1', { reward: 500 });

      expect(mockPetEmbeddingQueue.enqueueEmbedPetData).not.toHaveBeenCalled();
    });

    it('does not fail the request when the embedding re-enqueue throws', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1', name: 'Rex' }));
      mockRepository.update.mockResolvedValue(buildPet({ name: 'Max' }));
      mockPetEmbeddingQueue.enqueueEmbedPetData.mockRejectedValue(new Error('redis unavailable'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.updatePet('pet-1', 'owner-1', { name: 'Max' })).resolves.toBeDefined();
    });
  });

  describe('updatePetStatus', () => {
    it('throws 403 when the requester is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.updatePetStatus('pet-1', 'someone-else', 'resolved')).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    it.each(['missing', 'found', 'paused', 'resolved'] as const)(
      'passes status %s through to repository.updateStatus for the owner',
      async (status) => {
        mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
        mockRepository.updateStatus.mockResolvedValue(buildPet({ status }));
        const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

        const result = await service.updatePetStatus('pet-1', 'owner-1', status);

        expect(mockRepository.updateStatus).toHaveBeenCalledWith('pet-1', status);
        expect(result.status).toBe(status);
      },
    );
  });

  describe('getSimilarPets', () => {
    it('passes petId and a default radius/limit through to repository.findSimilar and maps the results', async () => {
      const candidate = buildPet({ id: 'pet-2' });
      mockRepository.findSimilar.mockResolvedValue([{ ...candidate, distanceMeters: 1234.5 }]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.getSimilarPets('pet-1');

      expect(mockRepository.findSimilar).toHaveBeenCalledWith('pet-1', 15_000, 4);
      expect(result).toEqual([
        {
          id: 'pet-2',
          name: candidate.name,
          species: candidate.species,
          category: candidate.category,
          status: candidate.status,
          ownerId: candidate.ownerId,
          reward: candidate.reward,
          phone: candidate.phone,
          email: candidate.email,
          distinguishingMarks: candidate.distinguishingMarks,
          photoUrl: candidate.photoUrl,
          photoUrls: candidate.photoUrls,
          city: candidate.city,
          sourceUrl: candidate.sourceUrl,
          originalContact: candidate.originalContact,
          isAdminAdded: candidate.isAdminAdded,
          location: candidate.location,
          createdAt: candidate.createdAt.toISOString(),
          distanceMeters: 1234.5,
        },
      ]);
    });

    it('passes a client-supplied radius through instead of the default', async () => {
      mockRepository.findSimilar.mockResolvedValue([]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.getSimilarPets('pet-1', 5000);

      expect(mockRepository.findSimilar).toHaveBeenCalledWith('pet-1', 5000, 4);
    });

    it('returns an empty array, not an error, when the repository finds nothing', async () => {
      mockRepository.findSimilar.mockResolvedValue([]);
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      const result = await service.getSimilarPets('pet-1');

      expect(result).toEqual([]);
    });

    it('propagates a rejection from repository.findSimilar without swallowing it', async () => {
      mockRepository.findSimilar.mockRejectedValue(new Error('DB failure'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.getSimilarPets('pet-1')).rejects.toThrow('DB failure');
    });
  });

  describe('deletePet', () => {
    it('throws 403 when the requester is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.deletePet('pet-1', 'someone-else')).rejects.toMatchObject({ statusCode: 403 });
      expect(mockRepository.deleteById).not.toHaveBeenCalled();
    });

    it('deletes the pet for its owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.deletePet('pet-1', 'owner-1');

      expect(mockRepository.deleteById).toHaveBeenCalledWith('pet-1');
    });

    it('removes every photo from storage after a successful delete', async () => {
      mockRepository.findById.mockResolvedValue(
        buildPet({ ownerId: 'owner-1', photoUrls: ['url-a', 'url-b'] }),
      );
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await service.deletePet('pet-1', 'owner-1');

      expect(mockImageStorageProvider.remove).toHaveBeenCalledTimes(2);
      expect(mockImageStorageProvider.remove).toHaveBeenCalledWith('url-a');
      expect(mockImageStorageProvider.remove).toHaveBeenCalledWith('url-b');
    });

    it('does not fail the delete when removing a photo from storage rejects', async () => {
      mockRepository.findById.mockResolvedValue(
        buildPet({ ownerId: 'owner-1', photoUrls: ['url-a'] }),
      );
      mockImageStorageProvider.remove.mockRejectedValue(new Error('cloudinary unavailable'));
      const service = createPetsService(mockRepository, mockImageStorageProvider, mockGeocodingService, mockPetEmbeddingQueue);

      await expect(service.deletePet('pet-1', 'owner-1')).resolves.toBeUndefined();
    });
  });
});
