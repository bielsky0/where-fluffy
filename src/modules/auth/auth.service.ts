import {
  AuthRepository,
  EMAIL_ALREADY_EXISTS_ERROR,
  OTP_CODE_LENGTH,
  OTP_TTL_MINUTES,
  PasswordHasher,
  TokenService,
} from './interface/auth.interface.js';
import { AuthResponseDTO } from './dto/auth-reponse-dto.js';
import { LoginDTO } from './dto/login.dto.js';
import { RegisterDTO } from './dto/register.dto.js';
import { RequestOtpResponseDTO } from './dto/otp.dto.js';
import { IUser } from './interface/user.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';

export type AuthService = {
  register: (dto: RegisterDTO) => Promise<Omit<IUser, 'password'>>;
  login: (dto: LoginDTO) => Promise<AuthResponseDTO>;
  requestOtp: (identifier: string) => Promise<RequestOtpResponseDTO>;
  verifyOtp: (identifier: string, code: string) => Promise<AuthResponseDTO>;
};

const generateOtpCode = (): string => {
  const max = 10 ** OTP_CODE_LENGTH;
  return Math.floor(Math.random() * max)
    .toString()
    .padStart(OTP_CODE_LENGTH, '0');
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

  // Ghost Account flow, krok 1: generuje kod, zapisuje go w OtpCode (5 min TTL) — na razie tylko
  // logujemy go (brak dostawcy e-mail/SMS, patrz CLAUDE.md/plan) i w trybie dev odsyłamy go w
  // odpowiedzi, żeby dało się przetestować cały przepływ end-to-end bez prawdziwego dostawcy.
  const requestOtp = async (identifier: string): Promise<RequestOtpResponseDTO> => {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await repository.createOtp(identifier, code, expiresAt);

    // eslint-disable-next-line no-console
    console.log(`[OTP] ${identifier} -> ${code} (wygasa o ${expiresAt.toISOString()})`);

    const isDev = process.env.NODE_ENV !== 'production';
    return {
      message: 'Kod został wysłany.',
      ...(isDev ? { devCode: code } : {}),
    };
  };

  // Ghost Account flow, krok 2: weryfikuje kod, tworzy (lub odnajduje) konto powiązane z
  // identyfikatorem i loguje dokładnie jak `login` — ten sam kształt AuthResponseDTO, żeby
  // kontroler mógł ustawić to samo ciasteczko `token` bez dodatkowej logiki.
  const verifyOtp = async (identifier: string, code: string): Promise<AuthResponseDTO> => {
    const validOtp = await repository.findValidOtp(identifier, code);
    if (!validOtp) {
      throw createAppError(401, 'Nieprawidłowy lub wygasły kod');
    }
    await repository.deleteOtp(validOtp.id);

    const user = await repository.findOrCreateGhostUser(identifier);
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

  return { register, login, requestOtp, verifyOtp };
};
