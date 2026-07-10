import { Prisma, type PrismaClient } from '@prisma/client';
import { RegisterDTO } from './dto/register.dto.js';
import { IUser } from './interface/user.interface.js';
import { AuthRepository, EMAIL_ALREADY_EXISTS_ERROR, OAuthProvider } from './interface/auth.interface.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export const createAuthRepository = (prisma: PrismaClient): AuthRepository => {
  const findByEmail = async (email: string): Promise<IUser | null> => {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? (user as IUser) : null;
  };

  const create = async (dto: Required<RegisterDTO>): Promise<IUser> => {
    try {
      const user = await prisma.user.create({
        data: {
          email: dto.email,
          password: dto.password,
          name: dto.name,
        },
      });
      return user as IUser;
    } catch (error) {
      // Tłumaczymy szczegół implementacyjny Prisma (naruszenie unikalności "email") na typowany,
      // niezależny od Prisma błąd repozytorium — service.ts i tak sprawdza to proaktywnie przez
      // findByEmail, więc to jest głównie ochrona przed race condition przy równoległych rejestracjach.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        throw new Error(EMAIL_ALREADY_EXISTS_ERROR);
      }
      throw error;
    }
  };

  const createOtp = async (email: string, code: string, expiresAt: Date): Promise<void> => {
    await prisma.otpCode.create({ data: { email, code, expiresAt } });
  };

  const findOtpByCode = async (email: string, code: string): Promise<{ id: string; expiresAt: Date } | null> => {
    const otp = await prisma.otpCode.findFirst({
      where: { email, code },
      orderBy: { createdAt: 'desc' },
    });
    return otp ? { id: otp.id, expiresAt: otp.expiresAt } : null;
  };

  const deleteOtp = async (id: string): Promise<void> => {
    await prisma.otpCode.delete({ where: { id } });
  };

  // Ghost Account: konto tworzone "w locie" przy pierwszej udanej weryfikacji OTP dla danego
  // e-maila — bez hasła (password: null), oznaczone isGhost: true. Odebranie kodu na ten adres
  // jest dowodem jego własności, więc emailVerified: true od razu. `name` jest w bazie NOT NULL,
  // więc dostaje wartość domyślną ("Gość") zamiast pytać o nią w tym szybkim flow.
  const findOrCreateGhostUser = async (email: string): Promise<IUser> => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return existing as IUser;
    }

    const created = await prisma.user.create({
      data: {
        email,
        password: null,
        isGhost: true,
        emailVerified: true,
        name: 'Gość',
      },
    });
    return created as IUser;
  };

  // OAuth: najpierw dopasowanie po tożsamości dostawcy (logowanie kolejny raz tym samym kontem
  // Google/Facebook), potem po e-mailu — User.email ma @unique, więc zwykłe `create` i tak
  // rzuciłoby P2002 przy kolizji; zamiast tego dowiązujemy tożsamość OAuth do istniejącego
  // wiersza (hasłowego lub Ghost Account), nie nadpisując jego pozostałych pól.
  const findOrCreateOAuthUser = async (
    provider: OAuthProvider,
    providerId: string,
    email: string,
    name: string,
  ): Promise<IUser> => {
    const byProvider = await prisma.user.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
    if (byProvider) {
      return byProvider as IUser;
    }

    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      const linked = await prisma.user.update({
        where: { id: byEmail.id },
        data: { provider, providerId, emailVerified: true },
      });
      return linked as IUser;
    }

    const created = await prisma.user.create({
      data: { email, name, provider, providerId, emailVerified: true, isGhost: false, password: null },
    });
    return created as IUser;
  };

  return {
    findByEmail,
    create,
    createOtp,
    findOtpByCode,
    deleteOtp,
    findOrCreateGhostUser,
    findOrCreateOAuthUser,
  };
};
