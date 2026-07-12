import { RawPetRow, mapToResponseDTO } from '../pets/pets.mapper.js';
import { ISearchResult } from './interfaces/search.interface.js';
import { SearchResultDTO } from './dto/search-result.dto.js';

export type RawSearchRow = RawPetRow & { similarity: number };

export const mapToSearchResult = (row: RawSearchRow): ISearchResult => ({
  id: row.id,
  name: row.name,
  species: row.species,
  category: row.category as ISearchResult['category'],
  status: row.status as ISearchResult['status'],
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
  similarity: Number(row.similarity),
});

export const mapToSearchResultDTO = (result: ISearchResult): SearchResultDTO => ({
  ...mapToResponseDTO(result),
  similarity: result.similarity,
});
