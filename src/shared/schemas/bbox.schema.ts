import { z } from 'zod';

// Query strings only ever carry a single "minLng,minLat,maxLng,maxLat" string — parsed and
// range-checked here so both src/modules/map/map.schema.ts and src/modules/feed/feed.schema.ts
// share one definition instead of duplicating the parsing/refine logic.
export const bboxSchema = z
  .string()
  .transform((value, ctx) => {
    const parts = value.split(',').map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bbox must be "minLng,minLat,maxLng,maxLat"' });
      return z.NEVER;
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    return { minLng, minLat, maxLng, maxLat };
  })
  .refine(
    ({ minLng, minLat, maxLng, maxLat }) => minLng >= -180 && maxLng <= 180 && minLat >= -90 && maxLat <= 90,
    { message: 'bbox coordinates out of range' },
  )
  .refine(({ minLng, maxLng }) => minLng < maxLng, { message: 'bbox minLng must be less than maxLng' })
  .refine(({ minLat, maxLat }) => minLat < maxLat, { message: 'bbox minLat must be less than maxLat' });

export type Bbox = z.infer<typeof bboxSchema>;
