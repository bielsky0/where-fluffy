import { Resend } from 'resend';
import { prisma } from '../../shared/prisma.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { JWT_SECRET } from '../../shared/config/auth.config.js';
import { RESEND_API_KEY, EMAIL_FROM_ADDRESS } from '../../shared/config/email.config.js';
import { oauthConfig } from '../../shared/config/oauth.config.js';
import { createAuthRepository } from './auth.repository.js';
import { createBcryptPasswordHasher } from './auth.hasher.js';
import { createJwtTokenService } from './auth.token.js';
import { createResendEmailSender } from './auth.email.js';
import { createGoogleOAuthVerifier } from './auth.oauth.google.js';
import { createFacebookOAuthVerifier } from './auth.oauth.facebook.js';
import { createOAuthStateStore } from './auth.oauth-state.store.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';
import { createOAuthController } from './auth.oauth.controller.js';
import { EmailSender } from './interface/auth.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';

export const authRepository = createAuthRepository(prisma);
export const passwordHasher = createBcryptPasswordHasher();
export const tokenService = createJwtTokenService(JWT_SECRET);

// The `Resend` SDK's constructor throws synchronously if the key is missing/empty — so it can
// only be constructed when a real key is actually configured, or importing this module (and
// therefore booting the whole app) would crash in local dev, where RESEND_API_KEY is normally
// unset and requestOtp never calls sendOtpEmail anyway (see auth.service.ts's isDev branch).
// email.config.ts already throws at boot if NODE_ENV=production without a real key, so this
// branch is now only reachable in dev/test — kept as a clear failure instead of a silent no-op
// if requestOtp's isDev branch is ever bypassed.
export const emailSender: EmailSender = RESEND_API_KEY
  ? createResendEmailSender(new Resend(RESEND_API_KEY), EMAIL_FROM_ADDRESS)
  : {
      sendOtpEmail: async () => {
        throw createAppError(500, 'RESEND_API_KEY nie jest skonfigurowany', true, 'EMAIL_SEND_FAILED');
      },
    };

export const authService = createAuthService(authRepository, passwordHasher, tokenService, emailSender);
export const authController = createAuthController(authService);

export const googleOAuthVerifier = createGoogleOAuthVerifier(oauthConfig.google);
export const facebookOAuthVerifier = createFacebookOAuthVerifier(oauthConfig.facebook);
export const oauthStateStore = createOAuthStateStore(redisClient);
export const oauthController = createOAuthController(
  authService,
  googleOAuthVerifier,
  facebookOAuthVerifier,
  oauthStateStore,
  oauthConfig.frontendUrl,
  { google: oauthConfig.google.enabled, facebook: oauthConfig.facebook.enabled },
);
