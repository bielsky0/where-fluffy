import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';
import { AuthRepository, PasswordHasher, TokenService } from './interface/auth.interface.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { buildMockHasher, buildMockRepository, buildMockTokenService, buildUser } from './auth.test-helpers.js';

// Minimalna, samodzielna apka Express — tylko trasy auth, żeby test nie zależał od
// pets/chat/Redis. Serwis jest prawdziwy (createAuthService), ale zbudowany na mockowanych
// repository/hasher/tokenService, dokładnie tak jak poprosił użytkownik: "inject mocked
// dependencies into the service, and the service into the controller".
const buildTestApp = (repository: AuthRepository, hasher: PasswordHasher, tokenService: TokenService): Express => {
  const authService = createAuthService(repository, hasher, tokenService);
  const controller = createAuthController(authService);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post('/auth/register', asyncHandler(controller.registerUser));
  app.post('/auth/login', asyncHandler(controller.loginUser));
  app.post('/auth/logout', asyncHandler(controller.logoutUser));

  app.use(errorHandler);
  return app;
};

describe('auth controller (via supertest)', () => {
  let mockRepository: jest.Mocked<AuthRepository>;
  let mockHasher: jest.Mocked<PasswordHasher>;
  let mockTokenService: jest.Mocked<TokenService>;
  let app: Express;

  beforeEach(() => {
    mockRepository = buildMockRepository();
    mockHasher = buildMockHasher();
    mockTokenService = buildMockTokenService();
    app = buildTestApp(mockRepository, mockHasher, mockTokenService);
  });

  describe('POST /auth/register', () => {
    it('returns 201 and the created user without a password field', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);
      mockHasher.hash.mockResolvedValue('hashed-value');
      mockRepository.create.mockResolvedValue(buildUser({ id: 'user-1', password: 'hashed-value' }));

      const response = await request(app).post('/auth/register').send({
        email: 'jane@example.com',
        password: 'plainTextPassword123',
        name: 'Jane Doe',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.body).not.toHaveProperty('password');
    });

    it('returns 400 with Zod validation details for a malformed body, without ever calling the service', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'not-an-email',
        password: 'short',
        name: 'A',
      });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Validation failed');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(mockRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('returns 400 when the service rejects because the email is already registered', async () => {
      mockRepository.findByEmail.mockResolvedValue(buildUser());

      const response = await request(app).post('/auth/register').send({
        email: 'jane@example.com',
        password: 'plainTextPassword123',
        name: 'Jane Doe',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ status: 'error', message: 'Ten adres e-mail jest już zajęty' });
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200, the user object, and sets an httpOnly "token" cookie for valid credentials', async () => {
      mockRepository.findByEmail.mockResolvedValue(buildUser({ id: 'user-1' }));
      mockHasher.compare.mockResolvedValue(true);
      mockTokenService.sign.mockReturnValue('signed.jwt.token');

      const response = await request(app).post('/auth/login').send({
        email: 'jane@example.com',
        password: 'plainTextPassword123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: { id: 'user-1', email: 'jane@example.com', name: 'Jane Doe' },
      });
      expect(response.body).not.toHaveProperty('token'); // token trafia wyłącznie do cookie

      const setCookieHeader = response.headers['set-cookie'] as unknown as string[];
      expect(setCookieHeader).toBeDefined();
      const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));
      expect(tokenCookie).toContain('signed.jwt.token');
      expect(tokenCookie).toContain('HttpOnly');
    });

    it('returns 401 with no cookie set for invalid credentials', async () => {
      mockRepository.findByEmail.mockResolvedValue(buildUser());
      mockHasher.compare.mockResolvedValue(false);

      const response = await request(app).post('/auth/login').send({
        email: 'jane@example.com',
        password: 'wrongPassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ status: 'error', message: 'Niepoprawny e-mail lub hasło' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('returns 401 when no user matches the email', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);

      const response = await request(app).post('/auth/login').send({
        email: 'nobody@example.com',
        password: 'whatever123',
      });

      expect(response.status).toBe(401);
      expect(mockHasher.compare).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 200 and clears the "token" cookie, independent of the service', async () => {
      const response = await request(app).post('/auth/logout').send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'success', message: 'Logged out successfully' });

      const setCookieHeader = response.headers['set-cookie'] as unknown as string[];
      const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/token=;/);
    });
  });
});
