import type { RedisClientType } from 'redis';
import { createMapService } from './map.service.js';
import { IMapPin, MapRepository, MapStatsResult } from './interfaces/map.interface.js';
import { MapConfig } from '../../shared/config/map.config.js';

const buildPin = (overrides: Partial<IMapPin> = {}): IMapPin => ({
  id: 'pet-1',
  lat: 52.2297,
  lng: 21.0122,
  status: 'missing',
  category: 'dog',
  ...overrides,
});

const testConfig: MapConfig = { MAP_STATS_CACHE_TTL_SECONDS: 180 };

describe('createMapService', () => {
  let mockMapRepository: jest.Mocked<MapRepository>;
  let mockRedisClient: jest.Mocked<Pick<RedisClientType, 'get' | 'setEx'>>;

  beforeEach(() => {
    mockMapRepository = { findPins: jest.fn(), getStats: jest.fn() };
    mockRedisClient = { get: jest.fn(), setEx: jest.fn() };
  });

  describe('getPins', () => {
    it('passes bbox mode params straight through to the repository', async () => {
      mockMapRepository.findPins.mockResolvedValue([buildPin()]);
      const service = createMapService(mockMapRepository, mockRedisClient as unknown as RedisClientType, testConfig);

      const params = { bbox: { minLng: 20.9, minLat: 52.15, maxLng: 21.15, maxLat: 52.3 }, category: 'dog' as const };
      const result = await service.getPins(params);

      expect(mockMapRepository.findPins).toHaveBeenCalledWith(params);
      expect(result).toEqual([buildPin()]);
    });

    it('passes radius mode params straight through to the repository', async () => {
      mockMapRepository.findPins.mockResolvedValue([buildPin()]);
      const service = createMapService(mockMapRepository, mockRedisClient as unknown as RedisClientType, testConfig);

      const params = { lat: 52.2297, lng: 21.0122, radiusInMeters: 5000 };
      const result = await service.getPins(params);

      expect(mockMapRepository.findPins).toHaveBeenCalledWith(params);
      expect(result).toEqual([buildPin()]);
    });

    it('propagates repository errors', async () => {
      mockMapRepository.findPins.mockRejectedValue(new Error('boom'));
      const service = createMapService(mockMapRepository, mockRedisClient as unknown as RedisClientType, testConfig);

      await expect(service.getPins({ lat: 52.2297, lng: 21.0122, radiusInMeters: 5000 })).rejects.toThrow('boom');
    });
  });

  describe('getStats', () => {
    const params = { lat: 52.2297, lng: 21.0122, radiusInMeters: 5000 };
    const stats: MapStatsResult = { total: 24, missing: 18, found: 6 };

    it('returns the cached value without calling the repository on a cache hit', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(stats));
      const service = createMapService(mockMapRepository, mockRedisClient as unknown as RedisClientType, testConfig);

      const result = await service.getStats(params);

      expect(result).toEqual(stats);
      expect(mockMapRepository.getStats).not.toHaveBeenCalled();
    });

    it('calls the repository and caches the result on a cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockMapRepository.getStats.mockResolvedValue(stats);
      const service = createMapService(mockMapRepository, mockRedisClient as unknown as RedisClientType, testConfig);

      const result = await service.getStats(params);

      expect(result).toEqual(stats);
      expect(mockMapRepository.getStats).toHaveBeenCalledWith(params);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'map:stats:52.23:21.01:5:all',
        testConfig.MAP_STATS_CACHE_TTL_SECONDS,
        JSON.stringify(stats),
      );
    });

    it('never caches a failed repository call', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockMapRepository.getStats.mockRejectedValue(new Error('boom'));
      const service = createMapService(mockMapRepository, mockRedisClient as unknown as RedisClientType, testConfig);

      await expect(service.getStats(params)).rejects.toThrow('boom');
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });
  });
});
