import express, { Express } from 'express';
import request from 'supertest';
import { createOAuthController } from './auth.oauth.controller.js';
import { AuthService } from './auth.service.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { buildMockOAuthStateStore, buildMockOAuthVerifier } from './auth.test-helpers.js';

const FRONTEND_URL = 'http://localhost:5173';

// Minimalny, samodzielny mock AuthService — tylko loginWithOAuth jest tu potrzebne, resztę
// zostawiamy jako jest.fn() nieużywane w tych testach.
const buildMockAuthService = (): jest.Mocked<AuthService> => ({
  register: jest.fn(),
  login: jest.fn(),
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  loginWithOAuth: jest.fn(),
});

const buildTestApp = (
  authService: AuthService,
  googleVerifier: ReturnType<typeof buildMockOAuthVerifier>,
  facebookVerifier: ReturnType<typeof buildMockOAuthVerifier>,
  stateStore: ReturnType<typeof buildMockOAuthStateStore>,
  providerEnabled: { google: boolean; facebook: boolean } = { google: true, facebook: true },
): Express => {
  const controller = createOAuthController(
    authService,
    googleVerifier,
    facebookVerifier,
    stateStore,
    FRONTEND_URL,
    providerEnabled,
  );

  const app = express();
  app.get('/auth/google', asyncHandler(controller.redirectToGoogle));
  app.get('/auth/google/callback', asyncHandler(controller.handleGoogleCallback));
  app.get('/auth/facebook', asyncHandler(controller.redirectToFacebook));
  app.get('/auth/facebook/callback', asyncHandler(controller.handleFacebookCallback));
  return app;
};

describe('OAuth controller (via supertest)', () => {
  let authService: jest.Mocked<AuthService>;
  let googleVerifier: ReturnType<typeof buildMockOAuthVerifier>;
  let facebookVerifier: ReturnType<typeof buildMockOAuthVerifier>;
  let stateStore: ReturnType<typeof buildMockOAuthStateStore>;

  beforeEach(() => {
    authService = buildMockAuthService();
    googleVerifier = buildMockOAuthVerifier();
    facebookVerifier = buildMockOAuthVerifier();
    stateStore = buildMockOAuthStateStore();
  });

  describe('GET /auth/google', () => {
    it('creates a state nonce and redirects to the provider authorization URL', async () => {
      stateStore.create.mockResolvedValue('nonce-123');
      googleVerifier.getAuthorizationUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=nonce-123');
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore);

      const response = await request(app).get('/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth?state=nonce-123');
      expect(googleVerifier.getAuthorizationUrl).toHaveBeenCalledWith('nonce-123');
    });

    it('redirects with ?error=oauth_disabled without starting a flow when the provider is disabled (kill switch)', async () => {
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore, {
        google: false,
        facebook: true,
      });

      const response = await request(app).get('/auth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${FRONTEND_URL}/auth/callback?error=oauth_disabled&provider=google`);
      expect(stateStore.create).not.toHaveBeenCalled();
      expect(googleVerifier.getAuthorizationUrl).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/google/callback', () => {
    it('exchanges the code, logs in via the service, sets the session cookie, and redirects to /auth/callback', async () => {
      stateStore.consume.mockResolvedValue(true);
      googleVerifier.exchangeCodeForProfile.mockResolvedValue({
        providerId: 'google-sub-1',
        email: 'jane@gmail.com',
        name: 'Jane Doe',
      });
      authService.loginWithOAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'jane@gmail.com', name: 'Jane Doe' },
        token: 'signed.jwt.token',
      });
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore);

      const response = await request(app).get('/auth/google/callback?code=auth-code&state=nonce-123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${FRONTEND_URL}/auth/callback`);
      expect(stateStore.consume).toHaveBeenCalledWith('nonce-123');
      expect(authService.loginWithOAuth).toHaveBeenCalledWith('google', {
        providerId: 'google-sub-1',
        email: 'jane@gmail.com',
        name: 'Jane Doe',
      });
      const setCookieHeader = response.headers['set-cookie'] as unknown as string[];
      const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));
      expect(tokenCookie).toContain('signed.jwt.token');
      expect(tokenCookie).toContain('HttpOnly');
    });

    it('redirects with ?error=oauth_failed and sets no cookie when the state nonce is invalid', async () => {
      stateStore.consume.mockResolvedValue(false);
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore);

      const response = await request(app).get('/auth/google/callback?code=auth-code&state=bad-nonce');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${FRONTEND_URL}/auth/callback?error=oauth_failed&provider=google`);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(authService.loginWithOAuth).not.toHaveBeenCalled();
    });

    it('redirects with ?error=oauth_failed when the provider reports an error (e.g. consent denied)', async () => {
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore);

      const response = await request(app).get('/auth/google/callback?error=access_denied');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${FRONTEND_URL}/auth/callback?error=oauth_failed&provider=google`);
      expect(stateStore.consume).not.toHaveBeenCalled();
    });

    it('redirects with ?error=oauth_failed when exchanging the code throws', async () => {
      stateStore.consume.mockResolvedValue(true);
      googleVerifier.exchangeCodeForProfile.mockRejectedValue(new Error('boom'));
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore);

      const response = await request(app).get('/auth/google/callback?code=auth-code&state=nonce-123');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(`${FRONTEND_URL}/auth/callback?error=oauth_failed&provider=google`);
    });
  });

  describe('GET /auth/facebook and /auth/facebook/callback', () => {
    it('follows the same redirect + cookie contract as Google, using the facebook provider label', async () => {
      stateStore.create.mockResolvedValue('nonce-456');
      facebookVerifier.getAuthorizationUrl.mockReturnValue('https://www.facebook.com/v19.0/dialog/oauth?state=nonce-456');
      stateStore.consume.mockResolvedValue(true);
      facebookVerifier.exchangeCodeForProfile.mockResolvedValue({
        providerId: 'fb-id-1',
        email: 'jane@fb.com',
        name: 'Jane Doe',
      });
      authService.loginWithOAuth.mockResolvedValue({
        user: { id: 'user-2', email: 'jane@fb.com', name: 'Jane Doe' },
        token: 'signed.jwt.token.fb',
      });
      const app = buildTestApp(authService, googleVerifier, facebookVerifier, stateStore);

      const startResponse = await request(app).get('/auth/facebook');
      expect(startResponse.headers.location).toBe('https://www.facebook.com/v19.0/dialog/oauth?state=nonce-456');

      const callbackResponse = await request(app).get('/auth/facebook/callback?code=auth-code&state=nonce-456');
      expect(callbackResponse.headers.location).toBe(`${FRONTEND_URL}/auth/callback`);
      expect(authService.loginWithOAuth).toHaveBeenCalledWith('facebook', {
        providerId: 'fb-id-1',
        email: 'jane@fb.com',
        name: 'Jane Doe',
      });
    });
  });
});
