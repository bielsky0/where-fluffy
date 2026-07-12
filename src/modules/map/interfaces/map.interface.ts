import type { PetCategory } from '../../pets/pets.category.js';

export interface IMapPin {
  id: string;
  lat: number;
  lng: number;
  status: 'missing' | 'found';
  category: PetCategory;
}

export type MapBbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type MapPinsParams = {
  // Map-viewport mode (mutually exclusive with lat/lng/radiusInMeters — enforced by
  // map.schema.ts's .refine()).
  bbox?: MapBbox;
  // Radius mode.
  lat?: number;
  lng?: number;
  radiusInMeters?: number;
  category?: PetCategory;
};

export type MapStatsParams = {
  // Stats is always "around a point" — no bbox alternative, unlike pins.
  lat: number;
  lng: number;
  radiusInMeters: number;
  category?: PetCategory;
};

export type MapStatsResult = { total: number; missing: number; found: number };

export type MapRepository = {
  findPins: (params: MapPinsParams) => Promise<IMapPin[]>;
  getStats: (params: MapStatsParams) => Promise<MapStatsResult>;
};
