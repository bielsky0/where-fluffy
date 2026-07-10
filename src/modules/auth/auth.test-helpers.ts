// Współdzielone fixture'y/mocki dla auth.service.spec.ts i auth.controller.spec.ts.
// Nazwa celowo NIE pasuje do wzorca *.spec.ts / *.test.ts, więc Jest jej nie traktuje
// jako osobnej suity testów.
import {
  AuthRepository,
  EmailSender,
  OAuthVerifier,
  OAuthStateStore,
  PasswordHasher,
  TokenService,
} from './interface/auth.interface.js';
import { IUser } from './interface/user.interface.js';
import { RegisterDTO } from './dto/register.dto.js';
import { LoginDTO } from './dto/login.dto.js';

export const buildMockRepository = (): jest.Mocked<AuthRepository> => ({
  findByEmail: jest.fn(),
  create: jest.fn(),
  createOtp: jest.fn(),
  findOtpByCode: jest.fn(),
  deleteOtp: jest.fn(),
  findOrCreateGhostUser: jest.fn(),
  findOrCreateOAuthUser: jest.fn(),
});

export const buildMockHasher = (): jest.Mocked<PasswordHasher> => ({
  hash: jest.fn(),
  compare: jest.fn(),
});

export const buildMockTokenService = (): jest.Mocked<TokenService> => ({
  sign: jest.fn(),
});

export const buildMockEmailSender = (): jest.Mocked<EmailSender> => ({
  sendOtpEmail: jest.fn(),
});

export const buildMockOAuthVerifier = (): jest.Mocked<OAuthVerifier> => ({
  getAuthorizationUrl: jest.fn(),
  exchangeCodeForProfile: jest.fn(),
});

export const buildMockOAuthStateStore = (): jest.Mocked<OAuthStateStore> => ({
  create: jest.fn(),
  consume: jest.fn(),
});

export const buildUser = (overrides: Partial<IUser> = {}): IUser => ({
  id: 'user-1',
  email: 'jane@example.com',
  password: 'hashed-password',
  phone: null,
  isGhost: false,
  provider: null,
  providerId: null,
  emailVerified: false,
  name: 'Jane Doe',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  ...overrides,
});

export const buildRegisterDto = (overrides: Partial<RegisterDTO> = {}): RegisterDTO => ({
  email: 'jane@example.com',
  password: 'plainTextPassword123',
  name: 'Jane Doe',
  ...overrides,
});

export const buildLoginDto = (overrides: Partial<LoginDTO> = {}): LoginDTO => ({
  email: 'jane@example.com',
  password: 'plainTextPassword123',
  ...overrides,
});
