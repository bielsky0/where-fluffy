import { Prisma, type PrismaClient } from '@prisma/client';
import { RegisterDTO } from './dto/register.dto.js';
import { IUser } from './interface/user.interface.js';
import { AuthRepository, EMAIL_ALREADY_EXISTS_ERROR } from './interface/auth.interface.js';

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

  return { findByEmail, create };
};
