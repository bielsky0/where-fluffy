import { z } from 'zod';

// Optional lat/lng: present together (GPS happy path — reverse-geocode the exact coords) or
// absent together (fall through to the existing IP-based lookup). z.coerce.number() because
// query-string params always arrive as strings.
export const locationMeQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((query) => (query.lat === undefined) === (query.lng === undefined), {
    message: 'Provide both lat and lng, or neither',
  });

export type LocationMeQuery = z.infer<typeof locationMeQuerySchema>;
