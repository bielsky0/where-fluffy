import { GeocodingConfig, geocodingConfig } from '../config/geocoding.config.js';
import { GeocodingService } from './interfaces/geocoding.interface.js';

type NominatimReverseResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
  };
};

// Never throws — same "Silent Fallback" contract location.service.ts already uses for GeoIP:
// pet creation must never fail or hang because a third-party geocoding API is slow/down. Any
// error (timeout, network failure, non-200, malformed JSON) resolves `null` instead, and the
// pet is saved without a city name (see pets.service.ts's reportMissingPet).
export const createGeocodingService = (config: GeocodingConfig = geocodingConfig): GeocodingService => {
  const reverseGeocode: GeocodingService['reverseGeocode'] = async (lat, lng) => {
    try {
      const url = new URL(config.NOMINATIM_BASE_URL);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));

      const response = await fetch(url, {
        headers: { 'User-Agent': config.NOMINATIM_USER_AGENT },
        signal: AbortSignal.timeout(config.GEOCODING_TIMEOUT_MS),
      });

      if (!response.ok) return null;

      const body = (await response.json()) as NominatimReverseResponse;
      const address = body.address;
      return address?.city ?? address?.town ?? address?.village ?? address?.suburb ?? null;
    } catch {
      return null;
    }
  };

  return { reverseGeocode };
};
