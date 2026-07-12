import { locationConfig } from '../../shared/config/location.config.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';
import { LocationRepository } from './interfaces/location.interface.js';
import { LocationResponseDTO } from './dto/location-response.dto.js';

export type ResolveLocationParams = { ip: string | undefined; lat?: number; lng?: number };

export type LocationService = {
  resolveLocation: (params: ResolveLocationParams) => Promise<LocationResponseDTO>;
};

export const createLocationService = (
  locationRepository: LocationRepository,
  geocodingService: GeocodingService,
): LocationService => {
  // Never throws — HTTP layer can never 500 because of geolocation, per the Silent Fallback rule.
  const resolveLocation: LocationService['resolveLocation'] = async ({ ip, lat, lng }) => {
    // GPS happy path: the client already knows better than an IP guess, so skip GeoIP entirely.
    // reverseGeocodeLabel never throws (see geocoding.service.ts's own Silent Fallback contract).
    // Deliberately NOT `?? FALLBACK_LOCATION_CITY` here: these coordinates are already correct —
    // falling back to "Warszawa" would show a specific but wrong city name next to a correct
    // pin, which is worse than showing no name at all. `city: null` lets the frontend fall back
    // to its own honest generic label (see useAppLocation.ts/Hero.tsx) instead.
    if (lat !== undefined && lng !== undefined) {
      const label = await geocodingService.reverseGeocodeLabel(lat, lng);
      return { lat, lng, city: label, source: 'gps' };
    }

    // location.repository.ts's lookup() already catches its own errors, but this try/catch is a
    // second line of defense so the "never throws" guarantee holds even if that changes.
    let geo = null;
    try {
      geo = ip ? locationRepository.lookup(ip) : null;
    } catch {
      geo = null;
    }

    // Same principle as the GPS branch above: MaxMind's GeoLite2 DB routinely resolves accurate
    // lat/lng for an IP with no city name attached (common for smaller towns) — falling back to
    // "Warszawa" here would show a specific but wrong city name next to an otherwise-correct pin.
    // `city: null` lets the frontend fall back to its own honest generic label instead.
    if (geo) {
      return { lat: geo.lat, lng: geo.lng, city: geo.city, source: 'geoip' };
    }

    return {
      lat: locationConfig.FALLBACK_LOCATION_LAT,
      lng: locationConfig.FALLBACK_LOCATION_LNG,
      city: locationConfig.FALLBACK_LOCATION_CITY,
      source: 'fallback',
    };
  };

  return { resolveLocation };
};
