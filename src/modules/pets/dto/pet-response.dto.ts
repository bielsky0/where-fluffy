import type { PetCategory } from '../pets.category.js';

export interface PetResponseDTO {
  id: string;
  name: string;
  species: string;
  category: PetCategory;
  status: 'missing' | 'found';
  reward: number;
  phone: string | null;
  distinguishingMarks: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  city: string | null;
  location: {
    lat: number;
    lng: number;
  };
  createdAt: string; // Sformatowana data dla frontendu
}