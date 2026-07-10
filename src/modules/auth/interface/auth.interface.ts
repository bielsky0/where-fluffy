import { RegisterDTO } from '../dto/register.dto.js';
import { IUser } from './user.interface.js';

export type OAuthProvider = 'google' | 'facebook';

// Znormalizowany kształt tożsamości zwrócony przez dowolnego dostawcę OAuth, niezależnie od
// różnic w ich własnych API (Google zwraca `sub`, Facebook `id` — oba mapujemy na `providerId`).
export type OAuthProfile = {
  providerId: string;
  email: string;
  name: string;
};

// Jeden kontrakt, dwie implementacje (auth.oauth.google.ts, auth.oauth.facebook.ts) — Authorization
// Code flow z pełnym przekierowaniem, zgodnie ze specyfikacją (nie popup/id-token po stronie klienta).
export type OAuthVerifier = {
  getAuthorizationUrl: (state: string) => string;
  exchangeCodeForProfile: (code: string) => Promise<OAuthProfile>;
};

export type EmailSender = {
  sendOtpEmail: (to: string, code: string) => Promise<void>;
};

// Jednorazowy, nieprzezroczysty nonce CSRF dla przepływu OAuth — NIGDY nie niesie ładunku do
// wznowienia (ten żyje w persystowanym store po stronie frontendu), tylko potwierdza, że
// callback faktycznie odpowiada na przekierowanie zainicjowane przez nasz backend.
export type OAuthStateStore = {
  create: () => Promise<string>;
  consume: (state: string) => Promise<boolean>;
};

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach)
export type AuthRepository = {
  findByEmail: (email: string) => Promise<IUser | null>;
  create: (dto: Required<RegisterDTO>) => Promise<IUser>;
  // Ghost Account flow (patrz auth.service.ts's requestOtp/verifyOtp): OtpCode nie jest
  // powiązany z Prisma-generowanym modelem klienta jak reszta repozytorium, więc to nadal proste
  // wywołania `prisma.otpCode.*`. Tylko e-mail — SMS nigdy nie jest wysyłany (patrz spec).
  createOtp: (email: string, code: string, expiresAt: Date) => Promise<void>;
  // Zwraca dopasowanie po email+code niezależnie od wygaśnięcia (expiresAt), żeby
  // verifyOtp mogło rozróżnić "niepoprawny kod" (brak dopasowania) od "kod wygasł" (dopasowanie,
  // ale expiresAt w przeszłości) — patrz auth.service.ts's verifyOtp.
  findOtpByCode: (email: string, code: string) => Promise<{ id: string; expiresAt: Date } | null>;
  deleteOtp: (id: string) => Promise<void>;
  findOrCreateGhostUser: (email: string) => Promise<IUser>;
  // OAuth: dopasowuje po (provider, providerId), a w razie braku — po e-mailu (dowiązuje
  // tożsamość OAuth do istniejącego konta hasłowego/Ghost zamiast tworzyć duplikat, bo
  // User.email ma @unique) — patrz auth.repository.ts.
  findOrCreateOAuthUser: (
    provider: OAuthProvider,
    providerId: string,
    email: string,
    name: string,
  ) => Promise<IUser>;
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

// Kody błędów (AppError.code) rozróżniające "zły kod" od "kod wygasł" — patrz auth.service.ts's
// verifyOtp. Konsumowane przez frontend zamiast dopasowywania polskiego tekstu komunikatu.
export const OTP_CODE_INVALID = 'OTP_CODE_INVALID';
export const OTP_CODE_EXPIRED = 'OTP_CODE_EXPIRED';
