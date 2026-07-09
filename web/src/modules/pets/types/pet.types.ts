// Mirrors the backend's PetResponseDTO (src/modules/pets/dto/pet-response.dto.ts). Duplicated
// here rather than imported because shared-types/ (repo root) is still an empty placeholder —
// once it's populated, both sides should import the DTO from there instead of hand-mirroring it.
export type PetStatus = 'missing' | 'found';

export interface Pet {
  id: string;
  name: string;
  species: string;
  status: PetStatus;
  reward: number;
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
// derives that from the authenticated request, not the client. Note there is only a "report
// missing" endpoint (`pets.service.ts`'s `reportMissingPet`) — there is no way to create a
// pet record with status 'found'; see add-listing-wizard/StepFork.tsx for how that gap is surfaced in the UI.
export interface CreatePetReportPayload {
  name: string;
  species: string;
  location: { lat: number; lng: number };
  reward: number;
}
