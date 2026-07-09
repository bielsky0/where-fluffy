import maxmind, { CityResponse, Reader } from 'maxmind';
import { logger } from '../../shared/infrastructure/logger.js';
import { locationConfig } from '../../shared/config/location.config.js';
import { GeoIpResult, LocationRepository } from './interfaces/location.interface.js';

export const createLocationRepository = (): LocationRepository => {
  let reader: Reader<CityResponse> | null = null;

  // Silent Fallback: a missing/corrupt .mmdb file (very likely in local dev — GeoLite2 requires
  // a MaxMind license and isn't checked into the repo) must never crash bootstrap(). lookup()
  // simply returns null forever if this fails, and location.service.ts's resolveLocationForIp
  // falls through to FALLBACK_LOCATION_* unconditionally — no separate error path anywhere else.
  const init = async (): Promise<void> => {
    try {
      reader = await maxmind.open<CityResponse>(locationConfig.GEOIP_DB_PATH);
      logger.info({ path: locationConfig.GEOIP_DB_PATH }, '[location] GeoIP database loaded');
    } catch (error) {
      logger.warn(
        { err: error, path: locationConfig.GEOIP_DB_PATH },
        '[location] Failed to load GeoIP database — every /location/me request will fall back to FALLBACK_LOCATION_*',
      );
      reader = null;
    }
  };

  const lookup = (ip: string): GeoIpResult | null => {
    if (!reader) return null;
    try {
      if (!maxmind.validate(ip)) return null;
      const result = reader.get(ip);
      if (!result?.location) return null;
      return { lat: result.location.latitude, lng: result.location.longitude, city: result.city?.names?.en ?? null };
    } catch (error) {
      logger.warn({ err: error, ip }, '[location] GeoIP lookup failed for this request — falling back');
      return null;
    }
  };

  return { init, lookup };
};
