import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { createRateLimiterMiddleware } from '../../shared/rate-limit/rate-limiter.middleware.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { authController } from './index.js';
import { loginSchema, registerSchema } from './auth.schema.js';

const router = Router();

// Ostrzejszy limit niż globalny (app.ts) — ochrona przed brute-force logowania. Ten sam wzorzec
// (ta sama fabryka, inne opcje) trywialnie rozszerza się na inne wrażliwe trasy, np. /register.
const loginRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:auth-login',
  points: 5,
  duration: 60,
  blockDuration: 300,
});

router.post('/register', validate(registerSchema), asyncHandler(authController.registerUser));
router.post('/login', loginRateLimiter, validate(loginSchema), asyncHandler(authController.loginUser));
router.post('/logout', asyncHandler(authController.logoutUser));
router.get('/me', authenticate, asyncHandler(authController.getMe));

export default router;