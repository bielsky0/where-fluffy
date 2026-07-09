import { createLocationService } from './location.service.js';
import { LocationRepository } from './interfaces/location.interface.js';

describe('createLocationService', () => {
  let mockRepository: jest.Mocked<LocationRepository>;

  beforeEach(() => {
    mockRepository = { init: jest.fn(), lookup: jest.fn() };
  });

  it('returns the GeoIP result with source "geoip" when the lookup succeeds', () => {
    mockRepository.lookup.mockReturnValue({ lat: 50.0647, lng: 19.945, city: 'Krakow' });
    const service = createLocationService(mockRepository);

    const result = service.resolveLocationForIp('1.2.3.4');

    expect(result).toEqual({ lat: 50.0647, lng: 19.945, city: 'Krakow', source: 'geoip' });
  });

  it('falls back to the configured city name when the GeoIP result has no city', () => {
    mockRepository.lookup.mockReturnValue({ lat: 50.0647, lng: 19.945, city: null });
    const service = createLocationService(mockRepository);

    const result = service.resolveLocationForIp('1.2.3.4');

    expect(result.city).toBe('Warszawa');
    expect(result.source).toBe('geoip');
  });

  it('falls back to FALLBACK_LOCATION_* when the lookup returns null', () => {
    mockRepository.lookup.mockReturnValue(null);
    const service = createLocationService(mockRepository);

    const result = service.resolveLocationForIp('127.0.0.1');

    expect(result).toEqual({ lat: 52.2297, lng: 21.0122, city: 'Warszawa', source: 'fallback' });
  });

  it('falls back without calling the repository when ip is undefined', () => {
    const service = createLocationService(mockRepository);

    const result = service.resolveLocationForIp(undefined);

    expect(mockRepository.lookup).not.toHaveBeenCalled();
    expect(result.source).toBe('fallback');
  });

  it('never throws, even if the repository somehow throws synchronously, and falls back instead', () => {
    mockRepository.lookup.mockImplementation(() => {
      throw new Error('unexpected repository failure');
    });
    const service = createLocationService(mockRepository);

    let result;
    expect(() => {
      result = service.resolveLocationForIp('1.2.3.4');
    }).not.toThrow();
    expect(result).toEqual({ lat: 52.2297, lng: 21.0122, city: 'Warszawa', source: 'fallback' });
  });
});
