import { z } from 'zod';

// Mirrors geocoding.config.ts's Zod-validated env pattern — every field has a .default() so this
// never throws at import time. PHOTON_TIMEOUT_MS is deliberately higher than
// GEOCODING_TIMEOUT_MS (900ms): that one guards a background reverse-geocode during pet creation
// (never allowed to visibly stall the user); this one is a foreground search-as-you-type call
// the frontend is actively waiting on and showing a spinner for, so a slightly longer budget
// before giving up is the right tradeoff.
const photonEnvSchema = z.object({
  PHOTON_BASE_URL: z.string().url().default('https://photon.komoot.io/api/'),
  PHOTON_USER_AGENT: z.string().min(1).default('where-fluffy/1.0 (contact@example.com)'),
  PHOTON_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  PHOTON_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  PHOTON_RESULT_LIMIT: z.coerce.number().int().positive().default(5),
});

export type PhotonConfig = z.infer<typeof photonEnvSchema>;

export const photonConfig: PhotonConfig = photonEnvSchema.parse(process.env);
