import { prisma } from '../../shared/prisma.js';
import { createAuthRepository } from './auth.repository.js';
import { createBcryptPasswordHasher } from './auth.hasher.js';
import { createJwtTokenService } from './auth.token.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';

// Ten sam fallback co w shared/middleware/auth.middleware.ts i shared/infrastructure/socket.ts
// (patrz CLAUDE.md — sekrety weryfikowane niezależnie w trzech miejscach, muszą pozostać zsynchronizowane).
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

export const authRepository = createAuthRepository(prisma);
export const passwordHasher = createBcryptPasswordHasher();
export const tokenService = createJwtTokenService(JWT_SECRET);
export const authService = createAuthService(authRepository, passwordHasher, tokenService);
export const authController = createAuthController(authService);
