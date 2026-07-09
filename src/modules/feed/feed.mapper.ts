import type { PetCategory } from '../pets/pets.category.js';
import { FeedPetResponseDTO } from './dto/feed-pet-response.dto.js';
import { IFeedPet } from './interfaces/feed.interface.js';

// Typ pomocniczy dla bazy danych (odzwierciedla to, co zwraca PostGIS po ST_X/ST_Y/ST_Distance)
export type RawFeedPetRow = {
  id: string;
  name: string;
  species: string;
  status: string;
  category: string;
  reward: number;
  createdAt: Date;
  lat: number;
  lng: number;
  distanceMeters: number;
};

export const mapFeedRowToDomain = (row: RawFeedPetRow): IFeedPet => ({
  id: row.id,
  name: row.name,
  species: row.species,
  category: row.category as PetCategory,
  status: row.status as 'missing' | 'found',
  reward: Number(row.reward),
  createdAt: row.createdAt,
  location: { lat: row.lat, lng: row.lng },
  distanceMeters: Number(row.distanceMeters),
});

export const mapFeedToResponseDTO = (pet: IFeedPet): FeedPetResponseDTO => ({
  id: pet.id,
  name: pet.name,
  species: pet.species,
  category: pet.category,
  status: pet.status,
  reward: Number(pet.reward),
  location: { lat: Number(pet.location.lat), lng: Number(pet.location.lng) },
  distanceMeters: Number(pet.distanceMeters),
  createdAt: pet.createdAt.toISOString(),
});
