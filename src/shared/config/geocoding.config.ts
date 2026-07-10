import { z } from 'zod';

// Mirrors location.config.ts's Zod-validated env pattern — every field has a .default() so this
// never throws at import time. NOMINATIM_USER_AGENT ships with a placeholder: Nominatim's usage
// policy (https://operations.osmfoundation.org/policies/nominatim/) requires a real contact
// identifier (app name + email/URL) in this header before production traffic hits it, or the
// requesting IP may be rate-limited/blocked.
const geocodingEnvSchema = z.object({
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org/reverse'),
  NOMINATIM_USER_AGENT: z.string().min(1).default('where-fluffy/1.0 (contact@example.com)'),
  GEOCODING_TIMEOUT_MS: z.coerce.number().int().positive().default(900),
});

export type GeocodingConfig = z.infer<typeof geocodingEnvSchema>;

export const geocodingConfig: GeocodingConfig = geocodingEnvSchema.parse(process.env);
