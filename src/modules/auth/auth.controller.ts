import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDTO } from './dto/login.dto.js';
import { RegisterDTO } from './dto/register.dto.js';

export type AuthController = {
  registerUser: (req: Request, res: Response) => Promise<void>;
  loginUser: (req: Request, res: Response) => Promise<void>;
  logoutUser: (req: Request, res: Response) => Promise<void>;
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
    res.cookie('token', token, {
      httpOnly: true,                         // Blokuje dostęp z poziomu JS (ochrona XSS)
      secure: process.env.NODE_ENV === 'production', // Wymaga HTTPS na produkcji
      sameSite: 'lax',                        // Ochrona przed CSRF
      maxAge: 24 * 60 * 60 * 1000,            // Czas życia ciasteczka: 1 dzień (w milisekundach)
    });

    // Zwracamy sam obiekt użytkownika, token ukrywa się w nagłówku Set-Cookie
    res.status(200).json({ user });
  };

  const logoutUser = async (req: Request, res: Response): Promise<void> => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  };

  return { registerUser, loginUser, logoutUser };
};
