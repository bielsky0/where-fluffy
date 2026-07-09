export type LocationSource = 'geoip' | 'fallback' | 'gps';

export interface AppLocation {
  lat: number;
  lng: number;
  city: string | null;
  source: LocationSource;
}
