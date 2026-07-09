import type { PetCategory } from '../../pets/pets.category.js';

// Mirrors PetResponseDTO's shape (src/modules/pets/dto/pet-response.dto.ts) exactly, plus
// distanceMeters — no ownerId/updatedAt, same as that DTO deliberately excludes them
// (pets.mapper.spec.ts asserts PetResponseDTO never leaks those fields).
export interface FeedPetResponseDTO {
  id: string;
  name: string;
  species: string;
  category: PetCategory;
  status: 'missing' | 'found';
  reward: number;
  location: { lat: number; lng: number };
  // null in bbox (map-viewport) mode — see feed.repository.ts's distanceFragment.
  distanceMeters: number | null;
  createdAt: string;
}

export interface FeedPageResponseDTO {
  items: FeedPetResponseDTO[];
  nextCursor: string | null;
}
