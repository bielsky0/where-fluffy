import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { createRateLimiterMiddleware } from '../../shared/rate-limit/rate-limiter.middleware.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { geocodeController } from './index.js';
import { geocodeSearchQuerySchema } from './geocode.schema.js';

const router = Router();

// Generous per-IP — a real user typing with a 300ms debounce can plausibly fire several
// requests/minute. No blockDuration: a burst of legitimate typing shouldn't earn a multi-minute
// lockout the way repeated failed logins should (see auth.routes.ts's loginRateLimiter). The
// Redis cache in geocode.service.ts, not this limiter, is the primary defense against hammering
// the public Photon instance in aggregate.
const geocodeSearchRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:geocode-search',
  points: 20,
  duration: 60,
});

router.get(
  '/search',
  geocodeSearchRateLimiter,
  validateQuery(geocodeSearchQuerySchema),
  asyncHandler(geocodeController.search),
);

export default router;
