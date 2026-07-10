import { photonFeatureToDomain, PhotonFeatureCollection } from './geocode.mapper.js';

describe('photonFeatureToDomain', () => {
  it('reindexes Photon\'s [minLon, maxLat, maxLon, minLat] extent into {minLng, minLat, maxLng, maxLat}', () => {
    const feature: PhotonFeatureCollection['features'][number] = {
      geometry: { coordinates: [17.0385, 51.1079] },
      properties: {
        name: 'Wrocław',
        country: 'Polska',
        extent: [16.8, 51.2, 17.2, 51.0], // [minLon, maxLat, maxLon, minLat]
      },
    };

    const result = photonFeatureToDomain(feature);

    expect(result.lng).toBe(17.0385);
    expect(result.lat).toBe(51.1079);
    expect(result.bbox).toEqual({ minLng: 16.8, minLat: 51.0, maxLng: 17.2, maxLat: 51.2 });
  });

  it('maps a missing extent (point feature) to bbox: null instead of fabricating one', () => {
    const feature: PhotonFeatureCollection['features'][number] = {
      geometry: { coordinates: [21.0122, 52.2297] },
      properties: { name: 'Marszałkowska', city: 'Warszawa' },
    };

    const result = photonFeatureToDomain(feature);

    expect(result.bbox).toBeNull();
  });

  it('composes a label from name/city/state/country, skipping missing and deduplicated fields', () => {
    const feature: PhotonFeatureCollection['features'][number] = {
      geometry: { coordinates: [17.0385, 51.1079] },
      properties: { name: 'Krzyki', city: 'Wrocław', country: 'Polska' },
    };

    expect(photonFeatureToDomain(feature).label).toBe('Krzyki, Wrocław, Polska');
  });

  it('deduplicates name and city when they are identical', () => {
    const feature: PhotonFeatureCollection['features'][number] = {
      geometry: { coordinates: [17.0385, 51.1079] },
      properties: { name: 'Wrocław', city: 'Wrocław', country: 'Polska' },
    };

    expect(photonFeatureToDomain(feature).label).toBe('Wrocław, Polska');
  });
});
