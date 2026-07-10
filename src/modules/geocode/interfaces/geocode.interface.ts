export interface IGeocodeResult {
  label: string;
  lat: number;
  lng: number;
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
}

export type GeocodeRepository = {
  search: (query: string) => Promise<IGeocodeResult[]>;
};
