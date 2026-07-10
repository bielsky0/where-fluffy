import { createPetsService } from './pets.service.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { PhotoService } from '../../shared/photo/photo.service.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';

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
  distinguishingMarks: null,
  photoUrl: null,
  photoUrls: [],
  city: null,
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
  ownerId: 'owner-1',
  ...overrides,
});

describe('createPetsService', () => {
  let mockRepository: jest.Mocked<PetRepository>;
  let mockPhotoService: jest.Mocked<PhotoService>;
  let mockGeocodingService: jest.Mocked<GeocodingService>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findNearLocation: jest.fn(),
    };
    mockPhotoService = {
      store: jest.fn(),
    };
    mockGeocodingService = {
      reverseGeocode: jest.fn().mockResolvedValue(null),
    };
  });

  describe('reportMissingPet', () => {
    it('passes the DTO through to repository.save with a server-computed category', async () => {
      const dto = buildCreateDto();
      mockRepository.save.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await service.reportMissingPet(dto);

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...dto,
        category: 'dog',
        photoUrl: undefined,
        photoUrls: [],
        city: null,
      });
    });

    it('categorizes the pet from its species before saving', async () => {
      const dto = buildCreateDto({ species: 'Kot europejski' });
      mockRepository.save.mockResolvedValue(buildPet({ category: 'cat' }));
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await service.reportMissingPet(dto);

      expect(mockRepository.save).toHaveBeenCalledWith({
        ...dto,
        category: 'cat',
        photoUrl: undefined,
        photoUrls: [],
        city: null,
      });
    });

    it('stores the photo via PhotoService and threads the returned URL into repository.save', async () => {
      const dto = buildCreateDto({ photoBase64: 'data:image/jpeg;base64,AAA' });
      mockPhotoService.store.mockResolvedValue('data:image/jpeg;base64,AAA');
      mockRepository.save.mockResolvedValue(buildPet({ photoUrl: 'data:image/jpeg;base64,AAA' }));
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await service.reportMissingPet(dto);

      expect(mockPhotoService.store).toHaveBeenCalledWith('data:image/jpeg;base64,AAA');
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          photoUrl: 'data:image/jpeg;base64,AAA',
          photoUrls: ['data:image/jpeg;base64,AAA'],
        }),
      );
    });

    it('skips PhotoService entirely when no photo was submitted', async () => {
      mockRepository.save.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await service.reportMissingPet(buildCreateDto());

      expect(mockPhotoService.store).not.toHaveBeenCalled();
    });

    it('maps the saved domain pet into a PetResponseDTO', async () => {
      const savedPet = buildPet({ id: 'pet-99', reward: 250 });
      mockRepository.save.mockResolvedValue(savedPet);
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      const result = await service.reportMissingPet(buildCreateDto());

      expect(result).toEqual({
        id: 'pet-99',
        name: savedPet.name,
        species: savedPet.species,
        category: savedPet.category,
        status: savedPet.status,
        reward: 250,
        phone: savedPet.phone,
        distinguishingMarks: savedPet.distinguishingMarks,
        photoUrl: savedPet.photoUrl,
        photoUrls: savedPet.photoUrls,
        city: savedPet.city,
        location: savedPet.location,
        createdAt: savedPet.createdAt.toISOString(),
      });
    });

    it('propagates a rejection from repository.save without swallowing it', async () => {
      mockRepository.save.mockRejectedValue(new Error('DB failure'));
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await expect(service.reportMissingPet(buildCreateDto())).rejects.toThrow('DB failure');
    });

    it('reverse-geocodes the DTO location and threads the resulting city into repository.save', async () => {
      const dto = buildCreateDto({ location: { lat: 52.2297, lng: 21.0122 } });
      mockGeocodingService.reverseGeocode.mockResolvedValue('Warszawa');
      mockRepository.save.mockResolvedValue(buildPet({ city: 'Warszawa' }));
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await service.reportMissingPet(dto);

      expect(mockGeocodingService.reverseGeocode).toHaveBeenCalledWith(52.2297, 21.0122);
      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ city: 'Warszawa' }));
    });

    it('saves the pet with city null when geocoding resolves null, without failing the request', async () => {
      mockGeocodingService.reverseGeocode.mockResolvedValue(null);
      mockRepository.save.mockResolvedValue(buildPet());
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await expect(service.reportMissingPet(buildCreateDto())).resolves.toBeDefined();

      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ city: null }));
    });
  });

  describe('getPetsNearby', () => {
    it('passes lat/lng/radius through to repository.findNearLocation and maps the results', async () => {
      const nearbyPet = buildPet({ id: 'pet-2' });
      mockRepository.findNearLocation.mockResolvedValue([nearbyPet]);
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      const result = await service.getPetsNearby(52.2297, 21.0122, 1000);

      expect(mockRepository.findNearLocation).toHaveBeenCalledWith(52.2297, 21.0122, 1000);
      expect(result).toEqual([
        {
          id: 'pet-2',
          name: nearbyPet.name,
          species: nearbyPet.species,
          category: nearbyPet.category,
          status: nearbyPet.status,
          reward: nearbyPet.reward,
          phone: nearbyPet.phone,
          distinguishingMarks: nearbyPet.distinguishingMarks,
          photoUrl: nearbyPet.photoUrl,
          photoUrls: nearbyPet.photoUrls,
          city: nearbyPet.city,
          location: nearbyPet.location,
          createdAt: nearbyPet.createdAt.toISOString(),
        },
      ]);
    });

    it('defaults radius to 5000 when not provided', async () => {
      mockRepository.findNearLocation.mockResolvedValue([]);
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await service.getPetsNearby(52.2297, 21.0122);

      expect(mockRepository.findNearLocation).toHaveBeenCalledWith(52.2297, 21.0122, 5000);
    });

    it('returns an empty array, not null/undefined, when the repository finds nothing', async () => {
      mockRepository.findNearLocation.mockResolvedValue([]);
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      const result = await service.getPetsNearby(52.2297, 21.0122);

      expect(result).toEqual([]);
    });

    it('propagates a rejection from repository.findNearLocation without swallowing it', async () => {
      mockRepository.findNearLocation.mockRejectedValue(new Error('DB failure'));
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await expect(service.getPetsNearby(52.2297, 21.0122)).rejects.toThrow('DB failure');
    });
  });

  describe('getPetById', () => {
    it('maps the found pet into a PetResponseDTO', async () => {
      const pet = buildPet({ id: 'pet-7' });
      mockRepository.findById.mockResolvedValue(pet);
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      const result = await service.getPetById('pet-7');

      expect(mockRepository.findById).toHaveBeenCalledWith('pet-7');
      expect(result.id).toBe('pet-7');
    });

    it('throws a 404 AppError when the pet does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const service = createPetsService(mockRepository, mockPhotoService, mockGeocodingService);

      await expect(service.getPetById('missing-id')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Zgłoszenie zwierzaka nie istnieje',
      });
    });
  });
});
