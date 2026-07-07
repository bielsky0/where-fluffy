import { CreatePetDTO } from '../dto/create-pet.dto.js';

export interface IPet {
  id: string;
  name: string;
  species: string;
  // Ujednolicamy strukturę lokalizacji
  location: {
    lat: number;
    lng: number;
  };
  ownerId: string;
  status: 'missing' | 'found';
  reward: number;
  createdAt: Date;
  updatedAt: Date;
}

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach)
export type PetRepository = {
  findById: (id: string) => Promise<IPet | null>;
  save: (dto: CreatePetDTO) => Promise<IPet>;
  findNearLocation: (lat: number, lng: number, radiusInMeters: number) => Promise<IPet[]>;
};