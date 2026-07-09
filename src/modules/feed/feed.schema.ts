import { z } from 'zod';
import { bboxSchema } from '../../shared/schemas/bbox.schema.js';

// z.coerce.number() because query-string params always arrive as strings.
const coordFields = {
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
};

export const urgentFeedQuerySchema = z.object({
  ...coordFields,
  radius: z.coerce.number().positive().max(50_000).optional(),
  category: z.enum(['dog', 'cat', 'other']).optional(),
});

// lat/lng/radius (proximity mode) and bbox (map-viewport mode) are mutually exclusive — exactly
// one must be supplied. urgentFeedQuerySchema above stays proximity-only on purpose (the urgent
// carousel doesn't have a map viewport to derive a bbox from).
export const feedQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().max(50_000).optional(),
    bbox: bboxSchema.optional(),
    category: z.enum(['dog', 'cat', 'other']).optional(),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .refine((query) => Boolean(query.bbox) !== (query.lat !== undefined && query.lng !== undefined), {
    message: 'Provide either bbox or lat/lng, not both/neither',
  });

export type UrgentFeedQuery = z.infer<typeof urgentFeedQuerySchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
