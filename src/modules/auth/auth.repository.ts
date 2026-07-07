import type { PrismaClient } from '@prisma/client';
import { RegisterDTO } from './dto/register.dto.js';
import { IUser } from './interface/user.interface.js';
import { AuthRepository } from './interface/auth.interface.js';

export const createAuthRepository = (prisma: PrismaClient): AuthRepository => {
  const findByEmail = async (email: string): Promise<IUser | null> => {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? (user as IUser) : null;
  };

  const create = async (dto: Required<RegisterDTO>): Promise<IUser> => {
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        password: dto.password,
        name: dto.name,
      },
    });
    return user as IUser;
  };

  return { findByEmail, create };
};
