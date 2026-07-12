import { z } from 'zod';

// Brak .default() celowo — w przeciwieństwie do photon.config.ts (ma sensowne wartości domyślne
// dla darmowego publicznego API), nie ma sensownego fallbacku dla cudzego klucza API. Wzoruje się
// na auth.config.ts/email.config.ts: proces ma wysadzić się na starcie, jeśli tych zmiennych
// brakuje, zamiast po cichu wysyłać zdjęcia donikąd.
const cloudinaryEnvSchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export type CloudinaryConfig = z.infer<typeof cloudinaryEnvSchema>;

export const cloudinaryConfig: CloudinaryConfig = cloudinaryEnvSchema.parse(process.env);
