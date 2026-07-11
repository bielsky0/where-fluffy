// Lustro updatePetSchema (pets.schema.ts) — wszystkie pola opcjonalne, nigdy `status` (patrz
// updatePetStatusSchema, osobny endpoint). Tylko klucze faktycznie obecne w żądaniu trafiają do
// PetRepository.update jako patch (patrz pets.service.ts's updatePet).
export interface UpdatePetDTO {
  name?: string;
  species?: string;
  location?: { lat: number; lng: number };
  reward?: number;
  phone?: string;
  email?: string;
  distinguishingMarks?: string;
  photoBase64s?: string[];
}
