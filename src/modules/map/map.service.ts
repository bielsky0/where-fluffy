import type { PetCategory } from '../pets/pets.category.js';
import { IMapPin, MapRepository } from './interfaces/map.interface.js';

export type MapService = {
  getPins: (params: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    category?: PetCategory;
  }) => Promise<IMapPin[]>;
};

export const createMapService = (mapRepository: MapRepository): MapService => {
  const getPins: MapService['getPins'] = (params) => mapRepository.findPinsInBbox(params);

  return { getPins };
};
