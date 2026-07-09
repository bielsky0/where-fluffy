import { bboxSchema } from './bbox.schema.js';

describe('bboxSchema', () => {
  it('parses a valid "minLng,minLat,maxLng,maxLat" string into a Bbox object', () => {
    const result = bboxSchema.safeParse('20.9,52.15,21.15,52.3');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ minLng: 20.9, minLat: 52.15, maxLng: 21.15, maxLat: 52.3 });
    }
  });

  it('rejects a string with the wrong number of parts', () => {
    expect(bboxSchema.safeParse('20.9,52.15,21.15').success).toBe(false);
  });

  it('rejects non-numeric parts', () => {
    expect(bboxSchema.safeParse('a,b,c,d').success).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(bboxSchema.safeParse('-200,52.15,21.15,52.3').success).toBe(false);
    expect(bboxSchema.safeParse('20.9,-100,21.15,52.3').success).toBe(false);
  });

  it('rejects an inverted envelope (minLng >= maxLng or minLat >= maxLat)', () => {
    expect(bboxSchema.safeParse('21.15,52.15,20.9,52.3').success).toBe(false);
    expect(bboxSchema.safeParse('20.9,52.3,21.15,52.15').success).toBe(false);
  });
});
