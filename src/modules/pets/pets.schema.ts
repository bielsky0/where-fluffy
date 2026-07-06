import { z } from 'zod';

export const createPetSchema = z.object({
name: z.string().min(2, 'Name must be at least 2 characters long'),
  species: z.string().min(2, 'Species is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  reward: z.number().nonnegative('Reward cannot be negative').default(0),
});

export const updatePetSchema = createPetSchema.partial();