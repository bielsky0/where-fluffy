import { AuthRepository, PasswordHasher, TokenService } from './interface/auth.interface.js';
import { AuthResponseDTO } from './dto/auth-reponse-dto.js';
import { LoginDTO } from './dto/login.dto.js';
import { RegisterDTO } from './dto/register.dto.js';
import { IUser } from './interface/user.interface.js';

export type AuthService = {
  register: (dto: RegisterDTO) => Promise<Omit<IUser, 'password'>>;
  login: (dto: LoginDTO) => Promise<AuthResponseDTO>;
};

// Ten sam kształt błędu co w reszcie repo (Error + .status, patrz CLAUDE.md/shared/middleware/error.middleware.ts),
// tylko bez "as any" — HttpError daje dokładnie to samo w runtime, przy pełnej typizacji.
type HttpError = Error & { status: number };

const createHttpError = (status: number, message: string): HttpError => {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
};

export const createAuthService = (
  repository: AuthRepository,
  hasher: PasswordHasher,
  tokenService: TokenService,
): AuthService => {
  const register = async (dto: RegisterDTO): Promise<Omit<IUser, 'password'>> => {
    const existingUser = await repository.findByEmail(dto.email);
    if (existingUser) {
      throw createHttpError(400, 'Ten adres e-mail jest już zajęty');
    }

    if (!dto.password) {
      throw createHttpError(400, 'Hasło jest wymagane');
    }

    const hashedPassword = await hasher.hash(dto.password);

    const newUser = await repository.create({
      ...dto,
      password: hashedPassword,
    });

    // Gwarancja bezpieczeństwa: usuwamy hasło z obiektu przed przekazaniem do kontrolera
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  };

  const login = async (dto: LoginDTO): Promise<AuthResponseDTO> => {
    const user = await repository.findByEmail(dto.email);
    if (!user || !user.password) {
      throw createHttpError(401, 'Niepoprawny e-mail lub hasło');
    }

    const isPasswordValid = await hasher.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw createHttpError(401, 'Niepoprawny e-mail lub hasło');
    }

    const token = tokenService.sign({ id: user.id, email: user.email, name: user.name });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  };

  return { register, login };
};
