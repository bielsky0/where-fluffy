import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { createRateLimiterMiddleware } from '../../shared/rate-limit/rate-limiter.middleware.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { Request } from 'express';
import { authController, oauthController } from './index.js';
import { loginSchema, registerSchema, requestOtpSchema, verifyOtpSchema } from './auth.schema.js';
import { RequestOtpDTO, VerifyOtpDTO } from './dto/otp.dto.js';

const router = Router();

// Ostrzejszy limit niż globalny (app.ts) — ochrona przed brute-force logowania. Ten sam wzorzec
// (ta sama fabryka, inne opcje) trywialnie rozszerza się na inne wrażliwe trasy, np. /register.
const loginRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:auth-login',
  points: 5,
  duration: 60,
  blockDuration: 300,
});

// Klucz po email (z body), nie po IP — inaczej niż loginRateLimiter powyżej, bo to, co chronimy
// tutaj, to spam kodami do JEDNEGO odbiorcy, nie brute-force z jednego adresu.
const otpRequestRateLimiter = createRateLimiterMiddleware(
  redisClient,
  { keyPrefix: 'rl:http:auth-otp-request', points: 3, duration: 60, blockDuration: 300 },
  (req: Request) => (req.body as RequestOtpDTO)?.email || (req.ip ?? 'unknown'),
);

// Brute-force ochrona 6-cyfrowego kodu — wcześniej /otp/verify nie miało żadnego limitu. Klucz po
// email tak samo jak otpRequestRateLimiter powyżej; nieco wyższy `points` niż przy request, bo
// legalny użytkownik może się pomylić raz czy dwa przy przepisywaniu kodu.
const otpVerifyRateLimiter = createRateLimiterMiddleware(
  redisClient,
  { keyPrefix: 'rl:http:auth-otp-verify', points: 5, duration: 60, blockDuration: 300 },
  (req: Request) => (req.body as VerifyOtpDTO)?.email || (req.ip ?? 'unknown'),
);

// Start OAuth: rzadko wywoływane bezpośrednio przez użytkownika (kliknięcie przycisku), więc
// luźniejszy limit niż callback poniżej — chroni głównie przed zautomatyzowanym generowaniem
// nonce'ów state (patrz auth.oauth-state.store.ts).
const oauthStartRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:oauth-start',
  points: 10,
  duration: 60,
  blockDuration: 60,
});

// Callback OAuth: wywoływane przez przekierowanie z Google/Facebooka, nie bezpośrednio przez
// klienta — nieco wyższy limit niż start, bo jeden użytkownik może wygenerować kilka callbacków
// przy ponawianiu (np. cofnięcie się w przeglądarce).
const oauthCallbackRateLimiter = createRateLimiterMiddleware(redisClient, {
  keyPrefix: 'rl:http:oauth-callback',
  points: 20,
  duration: 60,
  blockDuration: 60,
});

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
router.post(
  '/otp/verify',
  otpVerifyRateLimiter,
  validate(verifyOtpSchema),
  asyncHandler(authController.verifyOtp),
);

router.get('/google', oauthStartRateLimiter, asyncHandler(oauthController.redirectToGoogle));
router.get('/google/callback', oauthCallbackRateLimiter, asyncHandler(oauthController.handleGoogleCallback));
router.get('/facebook', oauthStartRateLimiter, asyncHandler(oauthController.redirectToFacebook));
router.get('/facebook/callback', oauthCallbackRateLimiter, asyncHandler(oauthController.handleFacebookCallback));

export default router;