import type { PetCategory } from '../../pets/pets.category.js';

export type FeedCursor = { createdAt: string; id: string };

export type FeedBbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export interface IFeedPet {
  id: string;
  name: string | null;
  species: string;
  category: PetCategory;
  status: 'missing' | 'found';
  reward: number;
  location: { lat: number; lng: number };
  // null in bbox mode — ST_Distance needs a single reference point to measure from, which a
  // viewport bbox doesn't have (see feed.repository.ts's distanceFragment).
  distanceMeters: number | null;
  // Content Seeding (admin) — patrz pets/interfaces/pets.interface.ts's IPet.isAdminAdded.
  isAdminAdded: boolean;
  createdAt: Date;
}

export type FeedPageParams = {
  // Proximity mode (mutually exclusive with bbox — enforced by feed.schema.ts's .refine()).
  lat?: number;
  lng?: number;
  radiusInMeters?: number;
  // Map-viewport mode.
  bbox?: FeedBbox;
  category?: PetCategory;
  cursor?: FeedCursor | null;
  limit: number;
};

export type FeedRepository = {
  findFeedPage: (params: FeedPageParams) => Promise<{ items: IFeedPet[]; hasNextPage: boolean }>;
};
