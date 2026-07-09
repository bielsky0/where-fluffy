import { feedQuerySchema } from './feed.schema.js';

describe('feedQuerySchema', () => {
  it('accepts proximity mode (lat/lng, no bbox)', () => {
    expect(feedQuerySchema.safeParse({ lat: '52.2297', lng: '21.0122' }).success).toBe(true);
  });

  it('accepts bbox mode (no lat/lng)', () => {
    expect(feedQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3' }).success).toBe(true);
  });

  it('rejects when neither bbox nor lat/lng is provided', () => {
    expect(feedQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects when both bbox and lat/lng are provided', () => {
    const result = feedQuerySchema.safeParse({ bbox: '20.9,52.15,21.15,52.3', lat: '52.2297', lng: '21.0122' });
    expect(result.success).toBe(false);
  });

  it('rejects lat without lng (partial proximity params, no bbox)', () => {
    expect(feedQuerySchema.safeParse({ lat: '52.2297' }).success).toBe(false);
  });
});
