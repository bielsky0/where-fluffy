import { createLocationService } from './location.service.js';
import { LocationRepository } from './interfaces/location.interface.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';

describe('createLocationService', () => {
  let mockRepository: jest.Mocked<LocationRepository>;
  let mockGeocodingService: jest.Mocked<GeocodingService>;

  beforeEach(() => {
    mockRepository = { init: jest.fn(), lookup: jest.fn() };
    mockGeocodingService = { reverseGeocode: jest.fn(), reverseGeocodeLabel: jest.fn() };
  });

  describe('IP-based path (no lat/lng provided)', () => {
    it('returns the GeoIP result with source "geoip" when the lookup succeeds', async () => {
      mockRepository.lookup.mockReturnValue({ lat: 50.0647, lng: 19.945, city: 'Krakow' });
      const service = createLocationService(mockRepository, mockGeocodingService);

      const result = await service.resolveLocation({ ip: '1.2.3.4' });

      expect(result).toEqual({ lat: 50.0647, lng: 19.945, city: 'Krakow', source: 'geoip' });
      expect(mockGeocodingService.reverseGeocodeLabel).not.toHaveBeenCalled();
    });

    it('returns city: null (not the configured fallback city) when the GeoIP result has coordinates but no city', async () => {
      mockRepository.lookup.mockReturnValue({ lat: 50.0647, lng: 19.945, city: null });
      const service = createLocationService(mockRepository, mockGeocodingService);

      const result = await service.resolveLocation({ ip: '1.2.3.4' });

      // The coordinates are already correct — falling back to "Warszawa" would show a specific
      // but wrong city name next to a correct pin, same principle as the GPS branch below.
      expect(result.city).toBeNull();
      expect(result.source).toBe('geoip');
    });

    it('falls back to FALLBACK_LOCATION_* when the lookup returns null', async () => {
      mockRepository.lookup.mockReturnValue(null);
      const service = createLocationService(mockRepository, mockGeocodingService);

      const result = await service.resolveLocation({ ip: '127.0.0.1' });

      expect(result).toEqual({ lat: 52.2297, lng: 21.0122, city: 'Warszawa', source: 'fallback' });
    });

    it('falls back without calling the repository when ip is undefined', async () => {
      const service = createLocationService(mockRepository, mockGeocodingService);

      const result = await service.resolveLocation({ ip: undefined });

      expect(mockRepository.lookup).not.toHaveBeenCalled();
      expect(result.source).toBe('fallback');
    });

    it('never throws, even if the repository somehow throws synchronously, and falls back instead', async () => {
      mockRepository.lookup.mockImplementation(() => {
        throw new Error('unexpected repository failure');
      });
      const service = createLocationService(mockRepository, mockGeocodingService);

      await expect(service.resolveLocation({ ip: '1.2.3.4' })).resolves.toEqual({
        lat: 52.2297,
        lng: 21.0122,
        city: 'Warszawa',
        source: 'fallback',
      });
    });
  });

  describe('GPS path (lat/lng provided)', () => {
    it('reverse-geocodes the exact coords and returns source "gps", skipping GeoIP entirely', async () => {
      mockGeocodingService.reverseGeocodeLabel.mockResolvedValue('Krzyki, Wrocław');
      const service = createLocationService(mockRepository, mockGeocodingService);

      const result = await service.resolveLocation({ ip: '1.2.3.4', lat: 51.08, lng: 17.02 });

      expect(result).toEqual({ lat: 51.08, lng: 17.02, city: 'Krzyki, Wrocław', source: 'gps' });
      expect(mockGeocodingService.reverseGeocodeLabel).toHaveBeenCalledWith(51.08, 17.02);
      expect(mockRepository.lookup).not.toHaveBeenCalled();
    });

    it('returns city: null (not the configured fallback city) when reverse-geocoding finds no label', async () => {
      // Unlike the IP-based paths above, the GPS branch must never substitute
      // FALLBACK_LOCATION_CITY here — the coordinates are already correct, so a specific but
      // wrong city name would be actively misleading (see location.service.ts's own comment).
      mockGeocodingService.reverseGeocodeLabel.mockResolvedValue(null);
      const service = createLocationService(mockRepository, mockGeocodingService);

      const result = await service.resolveLocation({ ip: '1.2.3.4', lat: 51.08, lng: 17.02 });

      expect(result).toEqual({ lat: 51.08, lng: 17.02, city: null, source: 'gps' });
    });
  });
});
