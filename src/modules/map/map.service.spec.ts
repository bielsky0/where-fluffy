import { createMapService } from './map.service.js';
import { IMapPin, MapRepository } from './interfaces/map.interface.js';

const buildPin = (overrides: Partial<IMapPin> = {}): IMapPin => ({
  id: 'pet-1',
  lat: 52.2297,
  lng: 21.0122,
  status: 'missing',
  ...overrides,
});

describe('createMapService', () => {
  let mockMapRepository: jest.Mocked<MapRepository>;

  beforeEach(() => {
    mockMapRepository = { findPinsInBbox: jest.fn() };
  });

  it('passes bbox + category straight through to the repository', async () => {
    mockMapRepository.findPinsInBbox.mockResolvedValue([buildPin()]);
    const service = createMapService(mockMapRepository);

    const params = { minLng: 20.9, minLat: 52.15, maxLng: 21.15, maxLat: 52.3, category: 'dog' as const };
    const result = await service.getPins(params);

    expect(mockMapRepository.findPinsInBbox).toHaveBeenCalledWith(params);
    expect(result).toEqual([buildPin()]);
  });

  it('propagates repository errors', async () => {
    mockMapRepository.findPinsInBbox.mockRejectedValue(new Error('boom'));
    const service = createMapService(mockMapRepository);

    await expect(
      service.getPins({ minLng: 20.9, minLat: 52.15, maxLng: 21.15, maxLat: 52.3 }),
    ).rejects.toThrow('boom');
  });
});
