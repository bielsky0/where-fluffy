import type { PetCategory } from '../pets.category.js';

export interface CreatePetDTO {
  name?: string;
  species: string;
  status: 'missing' | 'found';
  location: { lat: number; lng: number }; // Zmiana
  reward: number;
  phone?: string;
  email?: string;
  distinguishingMarks?: string;
  photoBase64s: string[];
  ownerId: string;
  // Content Seeding (admin) — undefined/false na zwykłej ścieżce POST /pets, ustawiane wyłącznie
  // przez pets.controller.ts's createAdminSeeded. Patrz pets.service.ts's reportMissingPet — brak
  // zmian tam, bo `{ photoBase64s, ...rest }` przenosi te pola dalej automatycznie.
  sourceUrl?: string;
  originalContact?: string;
  isAdminAdded?: boolean;
}

// What actually reaches PetRepository.save — CreatePetDTO (minus the raw photoBase64s, which
// pets.service.ts exchanges for stored `photoUrl`/`photoUrls` via PhotoService before this point)
// plus the server-computed category (see pets.service.ts's reportMissingPet / pets.category.ts's
// categorizePetSpecies). Clients never send category directly.
export interface CreatePetRecordDTO extends Omit<CreatePetDTO, 'photoBase64s'> {
  category: PetCategory;
  photoUrl?: string;
  photoUrls: string[];
  city: string | null;
}
