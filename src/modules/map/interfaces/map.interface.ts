import type { PetCategory } from '../../pets/pets.category.js';

export interface IMapPin {
  id: string;
  lat: number;
  lng: number;
  status: 'missing' | 'found';
}

export type MapRepository = {
  findPinsInBbox: (params: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    category?: PetCategory;
  }) => Promise<IMapPin[]>;
};
