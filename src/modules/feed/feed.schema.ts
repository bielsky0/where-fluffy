import { z } from 'zod';

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

export const feedQuerySchema = z.object({
  ...coordFields,
  radius: z.coerce.number().positive().max(50_000).optional(),
  category: z.enum(['dog', 'cat', 'other']).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type UrgentFeedQuery = z.infer<typeof urgentFeedQuerySchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
