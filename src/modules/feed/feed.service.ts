import { PetRepository } from '../pets/interfaces/pets.interface.js';
import { mapToResponseDTO } from '../pets/pets.mapper.js';
import { PetResponseDTO } from '../pets/dto/pet-response.dto.js';
import { PetCategory } from '../pets/pets.category.js';
import { FeedRepository } from './interfaces/feed.interface.js';
import { decodeFeedCursor, encodeFeedCursor } from './feed.cursor.js';
import { mapFeedToResponseDTO } from './feed.mapper.js';
import { FeedPageResponseDTO } from './dto/feed-pet-response.dto.js';

const URGENT_LIMIT = 10;

export type FeedService = {
  getUrgentNearby: (params: {
    lat: number;
    lng: number;
    radiusInMeters: number;
    category?: PetCategory;
  }) => Promise<PetResponseDTO[]>;
  getFeedPage: (params: {
    lat: number;
    lng: number;
    radiusInMeters: number;
    category?: PetCategory;
    cursor?: string | null;
    limit: number;
  }) => Promise<FeedPageResponseDTO>;
};

export const createFeedService = (feedRepository: FeedRepository, petRepository: PetRepository): FeedService => {
  // "Pilne w okolicy" — reuses PetRepository.findNearLocation (already exists for /pets/nearby)
  // instead of duplicating that query here, just with a server-enforced cap and optional
  // category filter.
  const getUrgentNearby: FeedService['getUrgentNearby'] = async ({ lat, lng, radiusInMeters, category }) => {
    const pets = await petRepository.findNearLocation(lat, lng, radiusInMeters, { category, limit: URGENT_LIMIT });
    return pets.map(mapToResponseDTO);
  };

  const getFeedPage: FeedService['getFeedPage'] = async ({ lat, lng, radiusInMeters, category, cursor, limit }) => {
    const decodedCursor = decodeFeedCursor(cursor);
    const { items, hasNextPage } = await feedRepository.findFeedPage({
      lat,
      lng,
      radiusInMeters,
      category,
      cursor: decodedCursor,
      limit,
    });
    const nextCursor = hasNextPage ? encodeFeedCursor(items[items.length - 1]) : null;
    return { items: items.map(mapFeedToResponseDTO), nextCursor };
  };

  return { getUrgentNearby, getFeedPage };
};
