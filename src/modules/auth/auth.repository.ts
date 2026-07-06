import { prisma } from "../../shared/prisma.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { IUser } from "./interface/user.interface.js";


export const findByEmail = async (email: string): Promise<IUser | null> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  return user as IUser;
};

export const create = async (dto: Required<RegisterDTO>): Promise<IUser> => {
  const user = await prisma.user.create({
    data: {
      email: dto.email,
      password: dto.password,
      name: dto.name,
    },
  });
  return user as IUser;
};