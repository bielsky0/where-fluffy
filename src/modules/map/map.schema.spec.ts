import { mapPinsQuerySchema } from './map.schema.js';

describe('mapPinsQuerySchema', () => {
  it('accepts a valid bbox with no category', () => {
    const result = mapPinsQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid bbox with a category filter', () => {
    const result = mapPinsQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3', category: 'dog' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing bbox', () => {
    expect(mapPinsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = mapPinsQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3', category: 'bird' });
    expect(result.success).toBe(false);
  });
});
