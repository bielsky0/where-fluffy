import { z } from 'zod';
import { bboxSchema } from '../../shared/schemas/bbox.schema.js';

export const mapPinsQuerySchema = z.object({
  bbox: bboxSchema,
  category: z.enum(['dog', 'cat', 'other']).optional(),
});

export type MapPinsQuery = z.infer<typeof mapPinsQuerySchema>;
