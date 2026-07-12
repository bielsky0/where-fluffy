import { mapPinsQuerySchema, mapStatsQuerySchema } from './map.schema.js';

describe('mapPinsQuerySchema', () => {
  it('accepts a valid bbox with no category', () => {
    const result = mapPinsQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid bbox with a category filter', () => {
    const result = mapPinsQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3', category: 'dog' });
    expect(result.success).toBe(true);
  });

  it('accepts radius mode (lat/lng/radius, no bbox)', () => {
    const result = mapPinsQuerySchema.safeParse({ lat: '52.2297', lng: '21.0122', radius: '5000' });
    expect(result.success).toBe(true);
  });

  it('rejects when neither bbox nor lat/lng/radius is provided', () => {
    expect(mapPinsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects when both bbox and lat/lng/radius are provided', () => {
    const result = mapPinsQuerySchema.safeParse({
      bbox: '20.9,52.15,21.15,52.3',
      lat: '52.2297',
      lng: '21.0122',
      radius: '5000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects partial radius-mode params (lat/lng without radius, no bbox)', () => {
    expect(mapPinsQuerySchema.safeParse({ lat: '52.2297', lng: '21.0122' }).success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = mapPinsQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3', category: 'bird' });
    expect(result.success).toBe(false);
  });
});

describe('mapStatsQuerySchema', () => {
  it('accepts lat/lng/radius with no category', () => {
    const result = mapStatsQuerySchema.safeParse({ lat: '52.2297', lng: '21.0122', radius: '5000' });
    expect(result.success).toBe(true);
  });

  it('accepts lat/lng/radius with a category filter', () => {
    const result = mapStatsQuerySchema.safeParse({ lat: '52.2297', lng: '21.0122', radius: '5000', category: 'cat' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing radius', () => {
    expect(mapStatsQuerySchema.safeParse({ lat: '52.2297', lng: '21.0122' }).success).toBe(false);
  });

  it('rejects a missing lat/lng', () => {
    expect(mapStatsQuerySchema.safeParse({ radius: '5000' }).success).toBe(false);
  });
});
