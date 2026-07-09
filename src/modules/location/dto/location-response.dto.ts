export interface LocationResponseDTO {
  lat: number;
  lng: number;
  city: string;
  source: 'geoip' | 'fallback';
}
