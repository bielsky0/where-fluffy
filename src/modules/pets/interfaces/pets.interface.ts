import { CreatePetRecordDTO } from '../dto/create-pet.dto.js';
import { PetCategory } from '../pets.category.js';

export interface IPet {
  id: string;
  // Opcjonalne: Znalazca nie podaje imienia (patrz pets.schema.ts's createPetSchema refine).
  name: string | null;
  species: string;
  category: PetCategory;
  // Ujednolicamy strukturę lokalizacji
  location: {
    lat: number;
    lng: number;
  };
  ownerId: string;
  status: 'missing' | 'found' | 'paused' | 'resolved';
  reward: number;
  phone: string | null;
  email: string | null;
  distinguishingMarks: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Patch przekazywany do PetRepository.update — tylko klucze faktycznie obecne w żądaniu edycji
// trafiają do wygenerowanego UPDATE (patrz pets.repository.ts's update).
export type PetUpdatePatch = Partial<{
  name: string | null;
  species: string;
  category: PetCategory;
  reward: number;
  phone: string | null;
  email: string | null;
  distinguishingMarks: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  city: string | null;
  location: { lat: number; lng: number };
}>;

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
  // Zwraca 'not_found' zamiast rzucać, gdy zwierzak zniknął między enqueue a przetworzeniem
  // zadania (uzasadniony race, nie błąd) — patrz ai-worker/embed-pet-data.processor.ts.
  updateEmbedding: (petId: string, vector: number[]) => Promise<'updated' | 'not_found'>;
  findByOwnerId: (ownerId: string) => Promise<IPet[]>;
  update: (petId: string, patch: PetUpdatePatch) => Promise<IPet | null>;
  updateStatus: (petId: string, status: IPet['status']) => Promise<IPet | null>;
  deleteById: (petId: string) => Promise<'deleted' | 'not_found'>;
};