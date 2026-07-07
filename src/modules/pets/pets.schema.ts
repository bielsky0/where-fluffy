import { z } from 'zod';

export const createPetSchema = z.object({
  name: z.string().min(2),
  species: z.string().min(2),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  reward: z.number().nonnegative().default(0),
});

export const updatePetSchema = createPetSchema.partial();