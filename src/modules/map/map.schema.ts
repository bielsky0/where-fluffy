import { z } from 'zod';
import { bboxSchema } from '../../shared/schemas/bbox.schema.js';

const categoryField = z.enum(['dog', 'cat', 'other']).optional();

// z.coerce.number() because query-string params always arrive as strings.
const coordFields = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(50_000).optional(),
};

// bbox (map-viewport mode) and lat/lng/radius (radius mode) are mutually exclusive — exactly one
// must be supplied. Mirrors feed.schema.ts's feedQuerySchema XOR pattern.
export const mapPinsQuerySchema = z
  .object({
    bbox: bboxSchema.optional(),
    ...coordFields,
    category: categoryField,
  })
  .refine(
    (query) =>
      Boolean(query.bbox) !== (query.lat !== undefined && query.lng !== undefined && query.radius !== undefined),
    { message: 'Provide either bbox or lat/lng/radius, not both/neither' },
  );

// Stats is always "around a point" — no bbox alternative, unlike pins.
export const mapStatsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50_000),
  category: categoryField,
});

export type MapPinsQuery = z.infer<typeof mapPinsQuerySchema>;
export type MapStatsQuery = z.infer<typeof mapStatsQuerySchema>;
