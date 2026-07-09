import { CreatePetRecordDTO } from '../dto/create-pet.dto.js';
import { PetCategory } from '../pets.category.js';

export interface IPet {
  id: string;
  name: string;
  species: string;
  category: PetCategory;
  // Ujednolicamy strukturę lokalizacji
  location: {
    lat: number;
    lng: number;
  };
  ownerId: string;
  status: 'missing' | 'found';
  reward: number;
  phone: string | null;
  distinguishingMarks: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach)
export type PetRepository = {
  findById: (id: string) => Promise<IPet | null>;
  save: (dto: CreatePetRecordDTO) => Promise<IPet>;
  findNearLocation: (
    lat: number,
    lng: number,
    radiusInMeters: number,
    options?: { category?: PetCategory; limit?: number },
  ) => Promise<IPet[]>;
};