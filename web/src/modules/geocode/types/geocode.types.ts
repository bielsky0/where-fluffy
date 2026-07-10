// Mirrors the backend's IGeocodeResult (src/modules/geocode/interfaces/geocode.interface.ts).
export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
}
