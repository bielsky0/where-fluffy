import { createSeoService } from './seo.service.js';
import { PetsService } from '../pets/pets.service.js';
import { PetResponseDTO } from '../pets/dto/pet-response.dto.js';

const buildPetResponse = (overrides: Partial<PetResponseDTO> = {}): PetResponseDTO => ({
  id: 'pet-1',
  name: 'Rex',
  species: 'pies',
  category: 'dog',
  status: 'missing',
  reward: 0,
  phone: null,
  distinguishingMarks: null,
  photoUrl: null,
  photoUrls: [],
  city: null,
  location: { lat: 52.2297, lng: 21.0122 },
  createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  ...overrides,
});

describe('createSeoService', () => {
  let mockPetsService: jest.Mocked<PetsService>;

  beforeEach(() => {
    mockPetsService = {
      reportMissingPet: jest.fn(),
      getPetsNearby: jest.fn(),
      getPetById: jest.fn(),
    };
  });

  it('builds HTML with the pet name, city, and photo baked into the OG tags', async () => {
    mockPetsService.getPetById.mockResolvedValue(
      buildPetResponse({ name: 'Rex', city: 'Warszawa', photoUrls: ['https://example.test/rex.jpg'] }),
    );
    const service = createSeoService(mockPetsService, 'https://wheresfluffy.test');

    const html = await service.buildPreviewHtml('pet-1');

    expect(html).toContain('Rex');
    expect(html).toContain('Warszawa');
    expect(html).toContain('https://example.test/rex.jpg');
    expect(html).toContain('https://wheresfluffy.test/app/pets/pet-1');
  });

  it('omits og:image when the pet has no photos', async () => {
    mockPetsService.getPetById.mockResolvedValue(buildPetResponse({ photoUrls: [] }));
    const service = createSeoService(mockPetsService, 'https://wheresfluffy.test');

    const html = await service.buildPreviewHtml('pet-1');

    expect(html).not.toContain('og:image');
  });

  it('returns null when the pet does not exist, instead of throwing', async () => {
    mockPetsService.getPetById.mockRejectedValue(new Error('not found'));
    const service = createSeoService(mockPetsService, 'https://wheresfluffy.test');

    await expect(service.buildPreviewHtml('missing-id')).resolves.toBeNull();
  });
});
