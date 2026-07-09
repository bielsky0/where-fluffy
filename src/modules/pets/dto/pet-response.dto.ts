import type { PetCategory } from '../pets.category.js';

export interface PetResponseDTO {
  id: string;
  name: string;
  species: string;
  category: PetCategory;
  status: 'missing' | 'found';
  reward: number;
  location: { 
    lat: number;
    lng: number;
  };
  createdAt: string; // Sformatowana data dla frontendu
}