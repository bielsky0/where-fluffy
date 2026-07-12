import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { createRateLimiterMiddleware } from '../../shared/rate-limit/rate-limiter.middleware.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { mapController } from './index.js';
import { mapPinsQuerySchema, mapStatsQuerySchema } from './map.schema.js';

const router = Router();

// Generous per-IP, no blockDuration — a dragged radius slider firing several debounced requests
// a minute is legitimate traffic, not abuse (same rationale as geocode-search's limiter). The
// Redis cache in map.service.ts's getStats, not this limiter, is the primary defense against
// hammering Postgres in aggregate.
const mapPinsRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:map-pins',
  points: 30,
  duration: 60,
});

const mapStatsRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:map-stats',
  points: 30,
  duration: 60,
});

router.get('/pins', mapPinsRateLimiter, validateQuery(mapPinsQuerySchema), asyncHandler(mapController.pins));
router.get('/stats', mapStatsRateLimiter, validateQuery(mapStatsQuerySchema), asyncHandler(mapController.stats));

export default router;
