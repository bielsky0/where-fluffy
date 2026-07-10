import type { RedisClientType } from 'redis';
import { createGeocodeService } from './geocode.service.js';
import { GeocodeRepository, IGeocodeResult } from './interfaces/geocode.interface.js';
import { PhotonConfig } from '../../shared/config/photon.config.js';

const buildResult = (overrides: Partial<IGeocodeResult> = {}): IGeocodeResult => ({
  label: 'Wrocław, Polska',
  lat: 51.1079,
  lng: 17.0385,
  bbox: null,
  ...overrides,
});

const testConfig: PhotonConfig = {
  PHOTON_BASE_URL: 'https://photon.example.com/api/',
  PHOTON_USER_AGENT: 'test-agent',
  PHOTON_TIMEOUT_MS: 2000,
  PHOTON_CACHE_TTL_SECONDS: 86400,
  PHOTON_RESULT_LIMIT: 5,
};

describe('createGeocodeService', () => {
  let mockGeocodeRepository: jest.Mocked<GeocodeRepository>;
  let mockRedisClient: jest.Mocked<Pick<RedisClientType, 'get' | 'setEx'>>;

  beforeEach(() => {
    mockGeocodeRepository = { search: jest.fn() };
    mockRedisClient = { get: jest.fn(), setEx: jest.fn() } as unknown as jest.Mocked<
      Pick<RedisClientType, 'get' | 'setEx'>
    >;
  });

  it('returns cached results without calling the repository on a cache hit', async () => {
    mockRedisClient.get.mockResolvedValue(JSON.stringify([buildResult()]));
    const service = createGeocodeService(mockGeocodeRepository, mockRedisClient as unknown as RedisClientType, testConfig);

    const results = await service.search('Wrocław');

    expect(results).toEqual([buildResult()]);
    expect(mockGeocodeRepository.search).not.toHaveBeenCalled();
  });

  it('calls the repository and caches the result with the configured TTL on a cache miss', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    mockGeocodeRepository.search.mockResolvedValue([buildResult()]);
    const service = createGeocodeService(mockGeocodeRepository, mockRedisClient as unknown as RedisClientType, testConfig);

    const results = await service.search('Wrocław');

    expect(mockGeocodeRepository.search).toHaveBeenCalledWith('Wrocław');
    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      'geocode:search:wrocław',
      testConfig.PHOTON_CACHE_TTL_SECONDS,
      JSON.stringify([buildResult()]),
    );
    expect(results).toEqual([buildResult()]);
  });

  it('normalizes the query so differently-cased/whitespaced input shares one cache key', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    mockGeocodeRepository.search.mockResolvedValue([]);
    const service = createGeocodeService(mockGeocodeRepository, mockRedisClient as unknown as RedisClientType, testConfig);

    await service.search(' Wrocław ');
    await service.search('WROCŁAW');

    expect(mockRedisClient.get).toHaveBeenNthCalledWith(1, 'geocode:search:wrocław');
    expect(mockRedisClient.get).toHaveBeenNthCalledWith(2, 'geocode:search:wrocław');
  });

  it('propagates a repository rejection instead of caching it', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    mockGeocodeRepository.search.mockRejectedValue(new Error('upstream down'));
    const service = createGeocodeService(mockGeocodeRepository, mockRedisClient as unknown as RedisClientType, testConfig);

    await expect(service.search('Wrocław')).rejects.toThrow('upstream down');
    expect(mockRedisClient.setEx).not.toHaveBeenCalled();
  });
});
