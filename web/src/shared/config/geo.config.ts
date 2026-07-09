import type { Coordinate } from '@/shared/components/map/types';

// Single source of truth for the app's fallback origin (Warsaw) — used whenever no real
// location (GeoIP-resolved or GPS-exact) is known yet. Matches the backend's
// FALLBACK_LOCATION_LAT/LNG defaults (src/shared/config/location.config.ts). Was previously
// duplicated as pets/lib/geo.ts's DEFAULT_CENTER and landing/components/HeroMap.tsx's own
// DECORATIVE_CENTER literal; both now import from here instead.
export const FALLBACK_ORIGIN: Coordinate = { lat: 52.2297, lng: 21.0122 };
export const FALLBACK_CITY_LABEL = 'Warszawa';
