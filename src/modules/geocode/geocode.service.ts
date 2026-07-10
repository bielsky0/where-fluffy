import type { RedisClientType } from 'redis';
import { PhotonConfig, photonConfig } from '../../shared/config/photon.config.js';
import { GeocodeRepository, IGeocodeResult } from './interfaces/geocode.interface.js';

export type GeocodeService = {
  search: (query: string) => Promise<IGeocodeResult[]>;
};

// Normalizes so "Wrocław" / " wrocław " / "WROCŁAW" all share one cache entry.
const cacheKey = (query: string) => `geocode:search:${query.trim().toLowerCase()}`;

// First generic get-or-fetch-with-TTL usage in this codebase (the only prior Redis TTL
// precedent, chat.presence.ts's grantUserAccess/checkUserAccess, is a one-off inline pair, not a
// reusable helper) — kept the same small size rather than building a generic CacheService for
// this one caller.
export const createGeocodeService = (
  geocodeRepository: GeocodeRepository,
  redisClient: RedisClientType,
  config: PhotonConfig = photonConfig,
): GeocodeService => {
  const search: GeocodeService['search'] = async (query) => {
    const key = cacheKey(query);

    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached) as IGeocodeResult[];

    const results = await geocodeRepository.search(query);
    // Only cache after a successful call — an upstream failure (repository throws) must never
    // be cached.
    await redisClient.setEx(key, config.PHOTON_CACHE_TTL_SECONDS, JSON.stringify(results));
    return results;
  };

  return { search };
};
