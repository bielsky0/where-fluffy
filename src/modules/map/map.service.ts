import type { RedisClientType } from 'redis';
import { mapConfig, MapConfig } from '../../shared/config/map.config.js';
import { IMapPin, MapPinsParams, MapRepository, MapStatsParams, MapStatsResult } from './interfaces/map.interface.js';

export type MapService = {
  getPins: (params: MapPinsParams) => Promise<IMapPin[]>;
  getStats: (params: MapStatsParams) => Promise<MapStatsResult>;
};

// Rounds lat/lng to 2 decimals (~1.1km buckets) so nearby users/GPS jitter share one cache entry,
// and radius to a whole km — this is what makes "popular radii in a busy area" actually cache-hit.
const cacheKey = (params: MapStatsParams): string => {
  const radiusKm = Math.round(params.radiusInMeters / 1000);
  return `map:stats:${params.lat.toFixed(2)}:${params.lng.toFixed(2)}:${radiusKm}:${params.category ?? 'all'}`;
};

export const createMapService = (
  mapRepository: MapRepository,
  redisClient: RedisClientType,
  config: MapConfig = mapConfig,
): MapService => {
  const getPins: MapService['getPins'] = (params) => mapRepository.findPins(params);

  const getStats: MapService['getStats'] = async (params) => {
    const key = cacheKey(params);

    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached) as MapStatsResult;

    const result = await mapRepository.getStats(params);
    // Only cache after a successful call — an upstream failure must never be cached.
    await redisClient.setEx(key, config.MAP_STATS_CACHE_TTL_SECONDS, JSON.stringify(result));
    return result;
  };

  return { getPins, getStats };
};
