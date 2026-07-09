import { z } from 'zod';

// Mirrors otel.config.ts's Zod-validated env pattern, but every field has a .default() so this
// never throws at import time — zero-.env-change local dev. FALLBACK_LOCATION_* defaults to
// Warsaw, matching web/src/shared/config/geo.config.ts's FALLBACK_ORIGIN on the frontend.
const locationEnvSchema = z.object({
  FALLBACK_LOCATION_LAT: z.coerce.number().min(-90).max(90).default(52.2297),
  FALLBACK_LOCATION_LNG: z.coerce.number().min(-180).max(180).default(21.0122),
  FALLBACK_LOCATION_CITY: z.string().min(1).default('Warszawa'),
  GEOIP_DB_PATH: z.string().min(1).default('./geoip/GeoLite2-City.mmdb'),
});

export type LocationConfig = z.infer<typeof locationEnvSchema>;

export const locationConfig: LocationConfig = locationEnvSchema.parse(process.env);
