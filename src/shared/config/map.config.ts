import { z } from 'zod';

// Mirrors photon.config.ts's Zod-validated env pattern — every field has a .default() so this
// never throws at import time. 180s ("a few minutes") balances a near-instant slider-driven
// header against stats going stale too long after a new report is created nearby.
const mapEnvSchema = z.object({
  MAP_STATS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(180),
});

export type MapConfig = z.infer<typeof mapEnvSchema>;

export const mapConfig: MapConfig = mapEnvSchema.parse(process.env);
