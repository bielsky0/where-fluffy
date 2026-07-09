import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { AuthService } from './auth.service.js';
import { LoginDTO } from './dto/login.dto.js';
import { RegisterDTO } from './dto/register.dto.js';
import { RequestOtpDTO, VerifyOtpDTO } from './dto/otp.dto.js';

const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // Blokuje dostęp z poziomu JS (ochrona XSS)
  secure: process.env.NODE_ENV === 'production', // Wymaga HTTPS na produkcji
  sameSite: 'lax' as const, // Ochrona przed CSRF
};

export type AuthController = {
  registerUser: (req: Request, res: Response) => Promise<void>;
  loginUser: (req: Request, res: Response) => Promise<void>;
  logoutUser: (req: Request, res: Response) => Promise<void>;
  getMe: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  requestOtp: (req: Request, res: Response) => Promise<void>;
  verifyOtp: (req: Request, res: Response) => Promise<void>;
};

export const createAuthController = (authService: AuthService): AuthController => {
  // req.body jest już zwalidowany i sparsowany przez middleware validate(registerSchema)
  // wpięty w auth.routes.ts, zanim żądanie tu dotrze.
  const registerUser = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.register(req.body as RegisterDTO);
    res.status(201).json(result);
  };

  // req.body jest już zwalidowany przez middleware validate(loginSchema) w auth.routes.ts.
  const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { user, token } = await authService.login(req.body as LoginDTO);

    // Ustawiamy ciasteczko z tokenem
    res.cookie('token', token, { ...TOKEN_COOKIE_OPTIONS, maxAge: 24 * 60 * 60 * 1000 });

    // Zwracamy sam obiekt użytkownika, token ukrywa się w nagłówku Set-Cookie
    res.status(200).json({ user });
  };

  const logoutUser = async (req: Request, res: Response): Promise<void> => {
    res.clearCookie('token', TOKEN_COOKIE_OPTIONS);
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  };

  // Przeszliśmy przez middleware `authenticate`, więc req.user na 100% istnieje — nie ma
  // potrzeby dodatkowego zapytania do bazy, payload z JWT wystarcza (patrz auth.middleware.ts).
  const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(200).json({ user: req.user });
  };

  // req.body jest już zwalidowany przez middleware validate(requestOtpSchema) w auth.routes.ts.
  const requestOtp = async (req: Request, res: Response): Promise<void> => {
    const { identifier } = req.body as RequestOtpDTO;
    const result = await authService.requestOtp(identifier);
    res.status(200).json(result);
  };

  // req.body jest już zwalidowany przez middleware validate(verifyOtpSchema) w auth.routes.ts.
  // Ustawia to samo ciasteczko `token` co loginUser — Ghost Account flow kończy się dokładnie
  // taką samą sesją jak logowanie hasłem.
  const verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const { identifier, code } = req.body as VerifyOtpDTO;
    const { user, token } = await authService.verifyOtp(identifier, code);

    res.cookie('token', token, { ...TOKEN_COOKIE_OPTIONS, maxAge: 24 * 60 * 60 * 1000 });
    res.status(200).json({ user });
  };

  return { registerUser, loginUser, logoutUser, getMe, requestOtp, verifyOtp };
};
