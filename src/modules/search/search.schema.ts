import { z } from 'zod';

export const searchPetsQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SearchPetsQuery = z.infer<typeof searchPetsQuerySchema>;
