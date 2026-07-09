import { Prisma, type PrismaClient } from '@prisma/client';
import { RegisterDTO } from './dto/register.dto.js';
import { IUser } from './interface/user.interface.js';
import { AuthRepository, EMAIL_ALREADY_EXISTS_ERROR } from './interface/auth.interface.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const createOtp = async (identifier: string, code: string, expiresAt: Date): Promise<void> => {
    await prisma.otpCode.create({ data: { identifier, code, expiresAt } });
  };

  const findValidOtp = async (identifier: string, code: string): Promise<{ id: string } | null> => {
    const otp = await prisma.otpCode.findFirst({
      where: { identifier, code, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return otp ? { id: otp.id } : null;
  };

  const deleteOtp = async (id: string): Promise<void> => {
    await prisma.otpCode.delete({ where: { id } });
  };

  // Ghost Account: konto tworzone "w locie" przy pierwszej udanej weryfikacji OTP dla danego
  // identyfikatora — bez hasła (password: null), oznaczone isGhost: true. `name` jest w bazie
  // NOT NULL, więc dostaje wartość domyślną ("Gość") zamiast pytać o nią w tym szybkim flow.
  const findOrCreateGhostUser = async (identifier: string): Promise<IUser> => {
    const isEmail = EMAIL_SHAPE.test(identifier);
    const existing = await prisma.user.findUnique({
      where: isEmail ? { email: identifier } : { phone: identifier },
    });
    if (existing) {
      return existing as IUser;
    }

    const created = await prisma.user.create({
      data: {
        email: isEmail ? identifier : null,
        phone: isEmail ? null : identifier,
        password: null,
        isGhost: true,
        name: 'Gość',
      },
    });
    return created as IUser;
  };

  return { findByEmail, create, createOtp, findValidOtp, deleteOtp, findOrCreateGhostUser };
};
