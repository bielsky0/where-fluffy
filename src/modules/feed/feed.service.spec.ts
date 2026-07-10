import { createFeedService } from './feed.service.js';
import { FeedRepository, IFeedPet } from './interfaces/feed.interface.js';
import { PetRepository, IPet } from '../pets/interfaces/pets.interface.js';
import { encodeFeedCursor } from './feed.cursor.js';

const buildPet = (overrides: Partial<IPet> = {}): IPet => ({
  id: 'pet-1',
  name: 'Rex',
  species: 'dog',
  category: 'dog',
  location: { lat: 52.2297, lng: 21.0122 },
  ownerId: 'owner-1',
  status: 'missing',
  reward: 100,
  phone: null,
  distinguishingMarks: null,
  photoUrl: null,
  photoUrls: [],
  city: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

const buildFeedPet = (overrides: Partial<IFeedPet> = {}): IFeedPet => ({
  id: 'pet-1',
  name: 'Rex',
  species: 'dog',
  category: 'dog',
  status: 'missing',
  reward: 100,
  location: { lat: 52.2297, lng: 21.0122 },
  distanceMeters: 120,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  ...overrides,
});

describe('createFeedService', () => {
  let mockFeedRepository: jest.Mocked<FeedRepository>;
  let mockPetRepository: jest.Mocked<PetRepository>;

  beforeEach(() => {
    mockFeedRepository = { findFeedPage: jest.fn() };
    mockPetRepository = { findById: jest.fn(), save: jest.fn(), findNearLocation: jest.fn() };
  });

  describe('getUrgentNearby', () => {
    it('forwards category/limit:10 to petRepository.findNearLocation and maps the results', async () => {
      mockPetRepository.findNearLocation.mockResolvedValue([buildPet()]);
      const service = createFeedService(mockFeedRepository, mockPetRepository);

      const result = await service.getUrgentNearby({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000, category: 'dog' });

      expect(mockPetRepository.findNearLocation).toHaveBeenCalledWith(52.2297, 21.0122, 5000, {
        category: 'dog',
        limit: 10,
      });
      expect(result).toEqual([
        expect.objectContaining({ id: 'pet-1', category: 'dog', status: 'missing' }),
      ]);
    });

    it('omits category when not provided', async () => {
      mockPetRepository.findNearLocation.mockResolvedValue([]);
      const service = createFeedService(mockFeedRepository, mockPetRepository);

      await service.getUrgentNearby({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000 });

      expect(mockPetRepository.findNearLocation).toHaveBeenCalledWith(52.2297, 21.0122, 5000, {
        category: undefined,
        limit: 10,
      });
    });
  });

  describe('getFeedPage', () => {
    it('computes nextCursor from the last item only when hasNextPage is true', async () => {
      const lastItem = buildFeedPet({ id: 'pet-last', createdAt: new Date('2026-01-01T09:00:00.000Z') });
      mockFeedRepository.findFeedPage.mockResolvedValue({ items: [buildFeedPet(), lastItem], hasNextPage: true });
      const service = createFeedService(mockFeedRepository, mockPetRepository);

      const page = await service.getFeedPage({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000, cursor: null, limit: 2 });

      expect(page.nextCursor).toBe(encodeFeedCursor(lastItem));
      expect(page.items).toHaveLength(2);
    });

    it('returns a null nextCursor when hasNextPage is false', async () => {
      mockFeedRepository.findFeedPage.mockResolvedValue({ items: [buildFeedPet()], hasNextPage: false });
      const service = createFeedService(mockFeedRepository, mockPetRepository);

      const page = await service.getFeedPage({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000, cursor: null, limit: 20 });

      expect(page.nextCursor).toBeNull();
    });

    it('decodes an incoming cursor string before passing it to the repository', async () => {
      mockFeedRepository.findFeedPage.mockResolvedValue({ items: [], hasNextPage: false });
      const service = createFeedService(mockFeedRepository, mockPetRepository);
      const cursor = encodeFeedCursor({ createdAt: new Date('2026-01-01T08:00:00.000Z'), id: 'pet-cursor' });

      await service.getFeedPage({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000, cursor, limit: 20 });

      expect(mockFeedRepository.findFeedPage).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { createdAt: '2026-01-01T08:00:00.000Z', id: 'pet-cursor' } }),
      );
    });

    it('passes a null cursor through untouched when none is supplied', async () => {
      mockFeedRepository.findFeedPage.mockResolvedValue({ items: [], hasNextPage: false });
      const service = createFeedService(mockFeedRepository, mockPetRepository);

      await service.getFeedPage({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000, cursor: null, limit: 20 });

      expect(mockFeedRepository.findFeedPage).toHaveBeenCalledWith(expect.objectContaining({ cursor: null }));
    });
  });
});
