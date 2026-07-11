// Mirrors the backend's PetResponseDTO (src/modules/pets/dto/pet-response.dto.ts). Duplicated
// here rather than imported because shared-types/ (repo root) is still an empty placeholder —
// once it's populated, both sides should import the DTO from there instead of hand-mirroring it.
import type { PetTypeFilter } from '../lib/petType';

// The two statuses public feed/map/nearby/search surfaces can ever return (server-side filtered
// — feed.repository.ts / map.repository.ts) — use this, not the wider PetStatus below, for any
// search-filter or map-pin type so 'paused'/'resolved' can't leak in as meaningless filter options.
export type PublicPetStatus = 'missing' | 'found';

// 'paused'/'resolved' additionally appear on: a pet the current user owns (Management Hub actions
// — see web/src/modules/profile/), and GET /pets/:petId's detail response, which has no status
// filter at all (a bookmarked link to a since-resolved/paused report still resolves).
export type PetStatus = PublicPetStatus | 'paused' | 'resolved';

export interface Pet {
  id: string;
  // Opcjonalne: Znalazca może nie znać imienia zwierzaka (Kreator V2) — patrz Pet.name w
  // schema.prisma.
  name: string | null;
  species: string;
  category: PetTypeFilter;
  status: PetStatus;
  ownerId: string;
  reward: number;
  phone: string | null;
  email: string | null;
  distinguishingMarks: string | null;
  photoUrls: string[];
  city: string | null;
  location: {
    lat: number;
    lng: number;
  };
  createdAt: string;
}

// Mirrors the backend's SimilarPetResponseDTO (src/modules/pets/dto/similar-pet-response.dto.ts)
// — GET /pets/:petId/similar.
export interface SimilarPet extends Pet {
  distanceMeters: number;
}

export interface NearbyPetsQuery {
  lat: number;
  lng: number;
  radius?: number;
}

// Matches CreatePetDTO (src/modules/pets/dto/create-pet.dto.ts) minus `ownerId` — the backend
// derives that from the authenticated request, not the client. `photoBase64s` are compressed
// data URLs (see add-listing-wizard/lib/compressImage.ts), exchanged server-side for stored
// `photoUrl`/`photoUrls` (see photo.service.ts). `name`/`reward` are omitted on the 'found' path
// (Znalazca doesn't know the pet's name and isn't offered a reward field); `phone`/`email` are
// each individually optional but the backend requires at least one of the two.
export interface CreatePetReportPayload {
  name?: string;
  species: string;
  status: PetStatus;
  location: { lat: number; lng: number };
  reward: number;
  phone?: string;
  email?: string;
  distinguishingMarks?: string;
  photoBase64s: string[];
}
