import type { PetCategory } from '../pets/pets.category.js';
import { IMapPin } from './interfaces/map.interface.js';

export type RawMapPinRow = {
  id: string;
  status: string;
  category: string;
  lat: number;
  lng: number;
};

export const mapPinRowToDomain = (row: RawMapPinRow): IMapPin => ({
  id: row.id,
  status: row.status as 'missing' | 'found',
  category: row.category as PetCategory,
  lat: Number(row.lat),
  lng: Number(row.lng),
});
