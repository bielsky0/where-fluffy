import { z } from 'zod';

// Brak lat/lng/limit — punkt odniesienia to lokalizacja zwierzaka o :petId, czytana po stronie
// serwera (patrz pets.repository.ts's findSimilar); klient nie może jej podmienić. `limit` jest
// zahardkodowany w serwisie (SIMILAR_PETS_LIMIT), zgodnie ze specyfikacją "wyświetlamy tylko 4".
export const similarPetsQuerySchema = z.object({
  radius: z.coerce.number().positive().max(50_000).optional(),
});

export type SimilarPetsQuery = z.infer<typeof similarPetsQuerySchema>;
