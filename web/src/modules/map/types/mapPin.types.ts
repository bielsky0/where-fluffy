import type { PublicPetStatus } from '@/modules/pets/types/pet.types';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';

// Mirrors the backend's IMapPin (src/modules/map/interfaces/map.interface.ts) — deliberately
// flat/minimal (GET /map/pins' whole point is the lightweight payload, see CLAUDE.md's
// dual-query architecture note), not a structural subset of Pet. status is PublicPetStatus, not
// the wider PetStatus — map.repository.ts filters 'paused'/'resolved' out server-side.
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  status: PublicPetStatus;
  category: PetTypeFilter;
}
