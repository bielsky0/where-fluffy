import { GeocodingConfig, geocodingConfig } from '../config/geocoding.config.js';
import { GeocodingService } from './interfaces/geocoding.interface.js';

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
};

type NominatimReverseResponse = {
  address?: NominatimAddress;
};

// Never throws — same "Silent Fallback" contract location.service.ts already uses for GeoIP: pet
// creation (reverseGeocode) and the public Hero's live location label (reverseGeocodeLabel) must
// never fail or hang because a third-party geocoding API is slow/down. Any error (timeout,
// network failure, non-200, malformed JSON) resolves `null` instead, never throws.
export const createGeocodingService = (config: GeocodingConfig = geocodingConfig): GeocodingService => {
  // Shared fetch/parse helper — one HTTP call site for both methods below.
  const fetchAddress = async (lat: number, lng: number): Promise<NominatimAddress | null> => {
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
      return body.address ?? null;
    } catch {
      return null;
    }
  };

  const reverseGeocode: GeocodingService['reverseGeocode'] = async (lat, lng) => {
    const address = await fetchAddress(lat, lng);
    return address?.city ?? address?.town ?? address?.village ?? address?.suburb ?? null;
  };

  // District-level label (e.g. "Krzyki, Wrocław") for the public Hero's live location display —
  // finer than reverseGeocode's bare city, which pets.service.ts's city-tagging call site keeps
  // using unchanged. Falls back to the bare city alone when no suburb/neighbourhood is present.
  const reverseGeocodeLabel: GeocodingService['reverseGeocodeLabel'] = async (lat, lng) => {
    const address = await fetchAddress(lat, lng);
    if (!address) return null;

    const city = address.city ?? address.town ?? address.village ?? null;
    const district = address.suburb ?? address.neighbourhood ?? null;

    if (district && city) return `${district}, ${city}`;
    return district ?? city ?? null;
  };

  return { reverseGeocode, reverseGeocodeLabel };
};
