export interface PetResponseDTO {
  id: string;
  name: string;
  species: string;
  status: 'missing' | 'found';
  reward: number;
  location: { 
    lat: number;
    lng: number;
  };
  createdAt: string; // Sformatowana data dla frontendu
}