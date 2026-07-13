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
  // Content Seeding (admin) — patrz dto/create-pet.dto.ts.
  sourceUrl: string | null;
  originalContact: string | null;
  isAdminAdded: boolean;
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

// "Podobne zwierzęta w okolicy" — wiersz kandydata plus odległość (metry) od zwierzaka źródłowego,
// policzona przez ST_Distance po stronie bazy (patrz pets.repository.ts's findSimilar).
export type ISimilarPet = IPet & { distanceMeters: number };

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
  // Pipeline jest vision-only: zwierzak bez zdjęć nie może mieć embeddingu (worker czyści
  // ewentualny stary wektor zamiast go zostawiać) — ten sam kontrakt 'not_found' co wyżej.
  clearEmbedding: (petId: string) => Promise<'updated' | 'not_found'>;
  findByOwnerId: (ownerId: string) => Promise<IPet[]>;
  update: (petId: string, patch: PetUpdatePatch) => Promise<IPet | null>;
  updateStatus: (petId: string, status: IPet['status']) => Promise<IPet | null>;
  deleteById: (petId: string) => Promise<'deleted' | 'not_found'>;
  // Łączy podobieństwo embeddingu (cosine, <=>) z filtrem geograficznym (ST_DWithin) wokół
  // lokalizacji zwierzaka o id=petId — patrz pets.repository.ts's findSimilar dla pełnego SQL-a
  // i listy przypadków, które celowo zwracają [] zamiast rzucać (petId nie istnieje, brak
  // embeddingu/lokalizacji źródła, zero trafień w promieniu). `minSimilarity` dodatkowo odcina
  // kandydatów zbyt różnych wizualnie (cosine similarity, nie surowy `<=>` distance) — wynik może
  // więc być krótszy niż `limit` również z tego powodu.
  findSimilar: (
    petId: string,
    radiusInMeters: number,
    limit: number,
    minSimilarity: number,
  ) => Promise<ISimilarPet[]>;
};