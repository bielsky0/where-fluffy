import { locationConfig } from '../../shared/config/location.config.js';
import { LocationRepository } from './interfaces/location.interface.js';
import { LocationResponseDTO } from './dto/location-response.dto.js';

export type LocationService = {
  resolveLocationForIp: (ip: string | undefined) => LocationResponseDTO;
};

export const createLocationService = (locationRepository: LocationRepository): LocationService => {
  // Never throws — HTTP layer can never 500 because of geolocation, per the Silent Fallback rule.
  // location.repository.ts's lookup() already catches its own errors, but this try/catch is a
  // second line of defense so the "never throws" guarantee holds even if that changes.
  const resolveLocationForIp: LocationService['resolveLocationForIp'] = (ip) => {
    let geo = null;
    try {
      geo = ip ? locationRepository.lookup(ip) : null;
    } catch {
      geo = null;
    }

    if (geo) {
      return { lat: geo.lat, lng: geo.lng, city: geo.city ?? locationConfig.FALLBACK_LOCATION_CITY, source: 'geoip' };
    }

    return {
      lat: locationConfig.FALLBACK_LOCATION_LAT,
      lng: locationConfig.FALLBACK_LOCATION_LNG,
      city: locationConfig.FALLBACK_LOCATION_CITY,
      source: 'fallback',
    };
  };

  return { resolveLocationForIp };
};
