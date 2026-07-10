import { z } from 'zod';

// min(2) is the real guarantee (a caller could hit this endpoint directly, bypassing the
// frontend's own length gate), not just a courtesy check.
export const geocodeSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Wpisz co najmniej 2 znaki').max(200),
});

export type GeocodeSearchQuery = z.infer<typeof geocodeSearchQuerySchema>;
