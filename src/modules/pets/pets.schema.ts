import { z } from 'zod';

export const createPetSchema = z.object({
  name: z.string().min(2),
  species: z.string().min(2),
  status: z.enum(['missing', 'found']).default('missing'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  reward: z.number().nonnegative().default(0),
  phone: z.string().min(9).max(20),
  distinguishingMarks: z.string().max(300).optional(),
  // Data URL (base64) skompresowanego zdjęcia — patrz photo.service.ts. Opcjonalne, zdjęcie nie
  // jest wymagane do zgłoszenia.
  photoBase64: z.string().optional(),
});

export const updatePetSchema = createPetSchema.partial();