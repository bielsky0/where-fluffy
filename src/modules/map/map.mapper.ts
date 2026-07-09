import { IMapPin } from './interfaces/map.interface.js';

export type RawMapPinRow = {
  id: string;
  status: string;
  lat: number;
  lng: number;
};

export const mapPinRowToDomain = (row: RawMapPinRow): IMapPin => ({
  id: row.id,
  status: row.status as 'missing' | 'found',
  lat: Number(row.lat),
  lng: Number(row.lng),
});
