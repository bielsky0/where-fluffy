import type { Pet } from '@/modules/pets/types/pet.types';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';

// Structural superset of Pet (id/name/species/category/status/reward/location/createdAt all
// present) so <PetCard/> keeps working unmodified — distanceMeters is the only extra field it
// ignores.
export interface FeedPet extends Pet {
  // null in bbox (map-viewport) mode — see src/modules/feed/feed.repository.ts's distanceFragment.
  distanceMeters: number | null;
}

export interface FeedPage {
  items: FeedPet[];
  nextCursor: string | null;
}

export interface FeedQueryParams {
  lat: number;
  lng: number;
  radius?: number;
  category?: PetTypeFilter;
}
