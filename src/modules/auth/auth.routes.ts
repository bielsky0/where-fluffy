import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { createRateLimiterMiddleware } from '../../shared/rate-limit/rate-limiter.middleware.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { Request } from 'express';
import { authController } from './index.js';
import { loginSchema, registerSchema, requestOtpSchema, verifyOtpSchema } from './auth.schema.js';
import { RequestOtpDTO } from './dto/otp.dto.js';

const router = Router();

// Ostrzejszy limit niż globalny (app.ts) — ochrona przed brute-force logowania. Ten sam wzorzec
// (ta sama fabryka, inne opcje) trywialnie rozszerza się na inne wrażliwe trasy, np. /register.
const loginRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:auth-login',
  points: 5,
  duration: 60,
  blockDuration: 300,
});

// Klucz po identifier (e-mail/telefon z body), nie po IP — inaczej niż loginRateLimiter powyżej,
// bo to, co chronimy tutaj, to spam kodami do JEDNEGO odbiorcy, nie brute-force z jednego adresu.
const otpRequestRateLimiter = createRateLimiterMiddleware(
  redisClient,
  { keyPrefix: 'rl:http:auth-otp-request', points: 3, duration: 60, blockDuration: 300 },
  (req: Request) => (req.body as RequestOtpDTO)?.identifier || (req.ip ?? 'unknown'),
);

router.post('/register', validate(registerSchema), asyncHandler(authController.registerUser));
router.post('/login', loginRateLimiter, validate(loginSchema), asyncHandler(authController.loginUser));
router.post('/logout', asyncHandler(authController.logoutUser));
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.post(
  '/otp/request',
  otpRequestRateLimiter,
  validate(requestOtpSchema),
  asyncHandler(authController.requestOtp),
);
router.post('/otp/verify', validate(verifyOtpSchema), asyncHandler(authController.verifyOtp));

export default router;