import type { PetCategory } from '../pets.category.js';

export interface CreatePetDTO {
  name: string;
  species: string;
  location: { lat: number; lng: number }; // Zmiana
  reward: number;
  ownerId: string;
}

// What actually reaches PetRepository.save — CreatePetDTO plus the server-computed category
// (see pets.service.ts's reportMissingPet / pets.category.ts's categorizePetSpecies). Clients
// never send category directly.
export interface CreatePetRecordDTO extends CreatePetDTO {
  category: PetCategory;
}