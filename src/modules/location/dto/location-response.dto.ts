export interface LocationResponseDTO {
  lat: number;
  lng: number;
  // null for 'gps' (reverseGeocodeLabel couldn't resolve a name) or 'geoip' (MaxMind resolved
  // coordinates but no city name) — see location.service.ts for why neither branch falls back to
  // FALLBACK_LOCATION_CITY the way the full-fallback 'fallback' source does.
  city: string | null;
  source: 'geoip' | 'fallback' | 'gps';
}
