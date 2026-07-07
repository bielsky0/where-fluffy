import { AuthRepository, EMAIL_ALREADY_EXISTS_ERROR, PasswordHasher, TokenService } from './interface/auth.interface.js';
import { AuthResponseDTO } from './dto/auth-reponse-dto.js';
import { LoginDTO } from './dto/login.dto.js';
import { RegisterDTO } from './dto/register.dto.js';
import { IUser } from './interface/user.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';

export type AuthService = {
  register: (dto: RegisterDTO) => Promise<Omit<IUser, 'password'>>;
  login: (dto: LoginDTO) => Promise<AuthResponseDTO>;
};

export const createAuthService = (
  repository: AuthRepository,
  hasher: PasswordHasher,
  tokenService: TokenService,
): AuthService => {
  const register = async (dto: RegisterDTO): Promise<Omit<IUser, 'password'>> => {
    const existingUser = await repository.findByEmail(dto.email);
    if (existingUser) {
      throw createAppError(400, 'Ten adres e-mail jest już zajęty');
    }

    if (!dto.password) {
      throw createAppError(400, 'Hasło jest wymagane');
    }

    const hashedPassword = await hasher.hash(dto.password);

    let newUser: IUser;
    try {
      newUser = await repository.create({
        ...dto,
        password: hashedPassword,
      });
    } catch (error) {
      // Osłona przed race condition: dwie równoległe rejestracje na ten sam e-mail obie mogą
      // minąć powyższy findByEmail, zanim jedna z nich zapisze wiersz — repozytorium tłumaczy to
      // na EMAIL_ALREADY_EXISTS_ERROR, tu zamieniamy na ten sam typowany błąd HTTP co wyżej.
      if (error instanceof Error && error.message === EMAIL_ALREADY_EXISTS_ERROR) {
        throw createAppError(400, 'Ten adres e-mail jest już zajęty');
      }
      throw error;
    }

    // Gwarancja bezpieczeństwa: usuwamy hasło z obiektu przed przekazaniem do kontrolera
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  };

  const login = async (dto: LoginDTO): Promise<AuthResponseDTO> => {
    const user = await repository.findByEmail(dto.email);
    if (!user || !user.password) {
      throw createAppError(401, 'Niepoprawny e-mail lub hasło');
    }

    const isPasswordValid = await hasher.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw createAppError(401, 'Niepoprawny e-mail lub hasło');
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
