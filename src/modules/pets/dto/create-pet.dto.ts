export interface CreatePetDTO {
  name: string;
  species: string;
  location: { lat: number; lng: number }; // Zmiana
  reward: number;
  ownerId: string;
}