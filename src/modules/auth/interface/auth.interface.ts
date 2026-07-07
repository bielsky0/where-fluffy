import { RegisterDTO } from '../dto/register.dto.js';
import { IUser } from './user.interface.js';

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach)
export type AuthRepository = {
  findByEmail: (email: string) => Promise<IUser | null>;
  create: (dto: Required<RegisterDTO>) => Promise<IUser>;
};

export type PasswordHasher = {
  hash: (plainText: string) => Promise<string>;
  compare: (plainText: string, hashedText: string) => Promise<boolean>;
};

export type TokenPayload = {
  id: string;
  email: string;
  name: string;
};

export type TokenService = {
  sign: (payload: TokenPayload) => string;
};
