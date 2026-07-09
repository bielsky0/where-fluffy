import type { PetCategory } from '../../pets/pets.category.js';

export type FeedCursor = { createdAt: string; id: string };

export interface IFeedPet {
  id: string;
  name: string;
  species: string;
  category: PetCategory;
  status: 'missing' | 'found';
  reward: number;
  location: { lat: number; lng: number };
  distanceMeters: number;
  createdAt: Date;
}

export type FeedRepository = {
  findFeedPage: (params: {
    lat: number;
    lng: number;
    radiusInMeters: number;
    category?: PetCategory;
    cursor?: FeedCursor | null;
    limit: number;
  }) => Promise<{ items: IFeedPet[]; hasNextPage: boolean }>;
};
