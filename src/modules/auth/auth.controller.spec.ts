import express, { Express, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';
import { AuthRepository, EmailSender, PasswordHasher, TokenService } from './interface/auth.interface.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { validate } from '../../shared/middleware/validate.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import {
  buildMockEmailSender,
  buildMockHasher,
  buildMockRepository,
  buildMockTokenService,
  buildUser,
} from './auth.test-helpers.js';

// Prawdziwe `authenticate` middleware wymaga poprawnego JWT w cookie (własna suita poza zakresem
// tego pliku — patrz auth.middleware.ts), więc dla /auth/me wstrzykujemy req.user bezpośrednio,
// tak jak zrobiłby to `authenticate` po udanej weryfikacji tokenu. Ten sam wzorzec co w
// comments.controller.spec.ts.
const fakeAuthenticate =
  (userId: string) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.user = { id: userId, email: 'jane@example.com', name: 'Jane Doe' };
    next();
  };

// Minimalna, samodzielna apka Express — tylko trasy auth, żeby test nie zależał od
// pets/chat/Redis. Serwis jest prawdziwy (createAuthService), ale zbudowany na mockowanych
// repository/hasher/tokenService, dokładnie tak jak poprosił użytkownik: "inject mocked
// dependencies into the service, and the service into the controller". Walidacja (`validate`)
// jest wpięta na poziomie trasy — tak jak w prawdziwym auth.routes.ts — bo kontroler już nie
// robi jej sam (patrz shared/middleware/validate.ts).
const buildTestApp = (
  repository: AuthRepository,
  hasher: PasswordHasher,
  tokenService: TokenService,
  emailSender: EmailSender,
): Express => {
  const authService = createAuthService(repository, hasher, tokenService, emailSender);
  const controller = createAuthController(authService);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post('/auth/register', validate(registerSchema), asyncHandler(controller.registerUser));
  app.post('/auth/login', validate(loginSchema), asyncHandler(controller.loginUser));
  app.post('/auth/logout', asyncHandler(controller.logoutUser));
  app.get('/auth/me', fakeAuthenticate('user-1'), asyncHandler(controller.getMe));

  app.use(errorHandler);
  return app;
};

describe('auth controller (via supertest)', () => {
  let mockRepository: jest.Mocked<AuthRepository>;
  let mockHasher: jest.Mocked<PasswordHasher>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockEmailSender: jest.Mocked<EmailSender>;
  let app: Express;

  beforeEach(() => {
    mockRepository = buildMockRepository();
    mockHasher = buildMockHasher();
    mockTokenService = buildMockTokenService();
    mockEmailSender = buildMockEmailSender();
    app = buildTestApp(mockRepository, mockHasher, mockTokenService, mockEmailSender);
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
        phone: null,
        isGhost: false,
        provider: null,
        providerId: null,
        emailVerified: false,
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

  describe('GET /auth/me', () => {
    it('returns 200 and the user carried on req.user by the auth middleware', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: { id: 'user-1', email: 'jane@example.com', name: 'Jane Doe' },
      });
    });
  });
});
