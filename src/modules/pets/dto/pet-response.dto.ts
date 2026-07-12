import type { PetCategory } from '../pets.category.js';

export interface PetResponseDTO {
  id: string;
  name: string | null;
  species: string;
  category: PetCategory;
  status: 'missing' | 'found' | 'paused' | 'resolved';
  ownerId: string;
  reward: number;
  phone: string | null;
  email: string | null;
  distinguishingMarks: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  city: string | null;
  sourceUrl: string | null;
  originalContact: string | null;
  isAdminAdded: boolean;
  location: {
    lat: number;
    lng: number;
  };
  createdAt: string; // Sformatowana data dla frontendu
}