import { createGeocodingService } from './geocoding.service.js';
import { GeocodingConfig } from '../config/geocoding.config.js';

const testConfig: GeocodingConfig = {
  NOMINATIM_BASE_URL: 'https://nominatim.example.test/reverse',
  NOMINATIM_USER_AGENT: 'where-fluffy-tests/1.0',
  GEOCODING_TIMEOUT_MS: 900,
};

describe('createGeocodingService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the city from a successful Nominatim response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { city: 'Warszawa' } }),
    }) as unknown as typeof fetch;

    const service = createGeocodingService(testConfig);
    const result = await service.reverseGeocode(52.2297, 21.0122);

    expect(result).toBe('Warszawa');
  });

  it('falls back through town/village/suburb when city is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { village: 'Zalesie' } }),
    }) as unknown as typeof fetch;

    const service = createGeocodingService(testConfig);
    const result = await service.reverseGeocode(52.0, 21.0);

    expect(result).toBe('Zalesie');
  });

  it('returns null when the response has no matching address field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: {} }),
    }) as unknown as typeof fetch;

    const service = createGeocodingService(testConfig);
    const result = await service.reverseGeocode(52.0, 21.0);

    expect(result).toBeNull();
  });

  it('returns null on a non-200 response instead of throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;

    const service = createGeocodingService(testConfig);

    await expect(service.reverseGeocode(52.0, 21.0)).resolves.toBeNull();
  });

  it('returns null when fetch rejects (network failure / timeout / abort)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;

    const service = createGeocodingService(testConfig);

    await expect(service.reverseGeocode(52.0, 21.0)).resolves.toBeNull();
  });

  it('returns null when the response body is malformed JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('unexpected token');
      },
    }) as unknown as typeof fetch;

    const service = createGeocodingService(testConfig);

    await expect(service.reverseGeocode(52.0, 21.0)).resolves.toBeNull();
  });

  describe('reverseGeocodeLabel', () => {
    it('composes "suburb, city" when both are present', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ address: { suburb: 'Krzyki', city: 'Wrocław' } }),
      }) as unknown as typeof fetch;

      const service = createGeocodingService(testConfig);
      const result = await service.reverseGeocodeLabel(51.08, 17.02);

      expect(result).toBe('Krzyki, Wrocław');
    });

    it('falls back to the bare city when no suburb/neighbourhood is present', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ address: { city: 'Warszawa' } }),
      }) as unknown as typeof fetch;

      const service = createGeocodingService(testConfig);
      const result = await service.reverseGeocodeLabel(52.2297, 21.0122);

      expect(result).toBe('Warszawa');
    });

    it('falls back to neighbourhood + town when suburb/city are absent', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ address: { neighbourhood: 'Stare Miasto', town: 'Wrocław' } }),
      }) as unknown as typeof fetch;

      const service = createGeocodingService(testConfig);
      const result = await service.reverseGeocodeLabel(51.11, 17.03);

      expect(result).toBe('Stare Miasto, Wrocław');
    });

    it('returns null when the response has no matching address field', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ address: {} }),
      }) as unknown as typeof fetch;

      const service = createGeocodingService(testConfig);

      await expect(service.reverseGeocodeLabel(52.0, 21.0)).resolves.toBeNull();
    });

    it('returns null when fetch rejects instead of throwing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;

      const service = createGeocodingService(testConfig);

      await expect(service.reverseGeocodeLabel(52.0, 21.0)).resolves.toBeNull();
    });
  });
});
