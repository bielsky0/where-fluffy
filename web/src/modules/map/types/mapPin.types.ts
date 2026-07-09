import type { PetStatus } from '@/modules/pets/types/pet.types';

// Mirrors the backend's IMapPin (src/modules/map/interfaces/map.interface.ts) — deliberately
// flat/minimal (GET /map/pins' whole point is the lightweight payload, see CLAUDE.md's
// dual-query architecture note), not a structural subset of Pet.
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  status: PetStatus;
}
