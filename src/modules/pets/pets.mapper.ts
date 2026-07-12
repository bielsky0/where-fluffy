import { PetResponseDTO } from './dto/pet-response.dto.js';
import { SimilarPetResponseDTO } from './dto/similar-pet-response.dto.js';
import { ISimilarPet, IPet } from './interfaces/pets.interface.js';
import { PetCategory } from './pets.category.js';

// Typ pomocniczy dla bazy danych (odzwierciedla to, co zwraca PostGIS po ST_X/ST_Y)
export type RawPetRow = {
  id: string;
  name: string | null;
  species: string;
  status: string;
  category: string;
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
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
};

// Mapper: konwertuje wiersz z bazy na domenowy model IPet
export const mapToDomain = (row: RawPetRow): IPet => ({
  id: row.id,
  name: row.name,
  species: row.species,
  category: row.category as PetCategory,
  status: row.status as 'missing' | 'found' | 'paused' | 'resolved',
  reward: Number(row.reward),
  phone: row.phone,
  email: row.email,
  distinguishingMarks: row.distinguishingMarks,
  photoUrl: row.photoUrl,
  photoUrls: row.photoUrls,
  city: row.city,
  sourceUrl: row.sourceUrl,
  originalContact: row.originalContact,
  isAdminAdded: row.isAdminAdded,
  ownerId: row.ownerId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  location: { lat: row.lat, lng: row.lng },
});

// Mapper: transformuje model domenowy na DTO wyjściowe
export const mapToResponseDTO = (pet: IPet): PetResponseDTO => ({
  id: pet.id,
  name: pet.name,
  species: pet.species,
  category: pet.category,
  status: pet.status,
  ownerId: pet.ownerId,
  reward: Number(pet.reward),
  phone: pet.phone,
  email: pet.email,
  distinguishingMarks: pet.distinguishingMarks,
  photoUrl: pet.photoUrl,
  photoUrls: pet.photoUrls,
  city: pet.city,
  sourceUrl: pet.sourceUrl,
  originalContact: pet.originalContact,
  isAdminAdded: pet.isAdminAdded,
  location: {
    lat: Number(pet.location.lat),
    lng: Number(pet.location.lng),
  },
  createdAt: pet.createdAt.toISOString(),
});

// "Podobne zwierzęta w okolicy" — ten sam wiersz co RawPetRow plus ST_Distance policzone przez
// findSimilar (patrz pets.repository.ts).
export type RawSimilarPetRow = RawPetRow & { distanceMeters: number };

export const mapToSimilarDomain = (row: RawSimilarPetRow): ISimilarPet => ({
  ...mapToDomain(row),
  distanceMeters: Number(row.distanceMeters),
});

export const mapToSimilarResponseDTO = (pet: ISimilarPet): SimilarPetResponseDTO => ({
  ...mapToResponseDTO(pet),
  distanceMeters: Number(pet.distanceMeters),
});
