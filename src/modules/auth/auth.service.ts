import { compare, hash } from "bcrypt";
import { create, findByEmail } from "./auth.repository.js";
import { AuthResponseDTO } from "./dto/auth-reponse-dto.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { IUser } from "./interface/user.interface.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

export const register = async (dto: RegisterDTO): Promise<Omit<IUser, 'password'>> => {
  const existingUser = await findByEmail(dto.email);
  if (existingUser) {
    const error = new Error('Ten adres e-mail jest już zajęty') as any;
    error.status = 400;
    throw error;
  }

  if (!dto.password) {
    const error = new Error('Hasło jest wymagane') as any;
    error.status = 400;
    throw error;
  }

  const hashedPassword = await hash(dto.password, 10);
  
  const newUser = await create({
    ...dto,
    password: hashedPassword,
  });

  // Gwarancja bezpieczeństwa: usuwamy hasło z obiektu przed przekazaniem do kontrolera
  const { password, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

export const login = async (dto: LoginDTO): Promise<AuthResponseDTO> => {
  const user = await findByEmail(dto.email);
  if (!user || !user.password) {
    const error = new Error('Niepoprawny e-mail lub hasło') as any;
    error.status = 401;
    throw error;
  }

  const isPasswordValid = await compare(dto.password, user.password);
  if (!isPasswordValid) {
    const error = new Error('Niepoprawny e-mail lub hasło') as any;
    error.status = 401;
    throw error;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
  };
};