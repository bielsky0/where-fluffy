export interface CreatePetDTO {
  name: string;
  species: string;
  latitude: number;
  longitude: number;
  reward: number;
  ownerId: string; // Wyciągane z tokenu JWT w kontrolerze
}