// Mirrors the backend's PetResponseDTO (src/modules/pets/dto/pet-response.dto.ts). Duplicated
// here rather than imported because shared-types/ (repo root) is still an empty placeholder —
// once it's populated, both sides should import the DTO from there instead of hand-mirroring it.
import type { PetTypeFilter } from '../lib/petType';

export type PetStatus = 'missing' | 'found';

export interface Pet {
  id: string;
  name: string;
  species: string;
  category: PetTypeFilter;
  status: PetStatus;
  reward: number;
  phone: string | null;
  distinguishingMarks: string | null;
  photoUrls: string[];
  city: string | null;
  location: {
    lat: number;
    lng: number;
  };
  createdAt: string;
}

export interface NearbyPetsQuery {
  lat: number;
  lng: number;
  radius?: number;
}

// Matches CreatePetDTO (src/modules/pets/dto/create-pet.dto.ts) minus `ownerId` — the backend
// derives that from the authenticated request, not the client. `photoBase64` is a compressed
// data URL (see add-listing-wizard/lib/compressImage.ts), exchanged server-side for a stored
// `photoUrl` (see photo.service.ts).
export interface CreatePetReportPayload {
  name: string;
  species: string;
  status: PetStatus;
  location: { lat: number; lng: number };
  reward: number;
  phone: string;
  distinguishingMarks?: string;
  photoBase64?: string;
}
