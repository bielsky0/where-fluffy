import { RegisterDTO } from '../dto/register.dto.js';
import { IUser } from './user.interface.js';

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach)
export type AuthRepository = {
  findByEmail: (email: string) => Promise<IUser | null>;
  create: (dto: Required<RegisterDTO>) => Promise<IUser>;
  // Ghost Account flow (patrz auth.service.ts's requestOtp/verifyOtp): OtpCode nie jest
  // powiązany z Prisma-generowanym modelem klienta jak reszta repozytorium, więc to nadal proste
  // wywołania `prisma.otpCode.*`.
  createOtp: (identifier: string, code: string, expiresAt: Date) => Promise<void>;
  findValidOtp: (identifier: string, code: string) => Promise<{ id: string } | null>;
  deleteOtp: (id: string) => Promise<void>;
  findOrCreateGhostUser: (identifier: string) => Promise<IUser>;
};

export type PasswordHasher = {
  hash: (plainText: string) => Promise<string>;
  compare: (plainText: string, hashedText: string) => Promise<boolean>;
};

export type TokenPayload = {
  id: string;
  email: string | null;
  name: string;
};

export type TokenService = {
  sign: (payload: TokenPayload) => string;
};

// Rzucane przez AuthRepository.create zamiast surowego PrismaClientKnownRequestError (P2002) —
// warstwa repozytorium nie powinna przeciekać szczegółów Prisma wyżej.
export const EMAIL_ALREADY_EXISTS_ERROR = 'EMAIL_ALREADY_EXISTS';

// Długość + TTL kodu OTP (Ghost Account flow) — patrz auth.service.ts's requestOtp/verifyOtp.
export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MINUTES = 5;
