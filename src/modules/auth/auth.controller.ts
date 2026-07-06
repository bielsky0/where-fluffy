import { Request, Response } from 'express';
import { login, register } from './auth.service.js';
import { registerSchema, loginSchema } from './auth.schema.js';


export const registerUser = async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);
  const result = await register(validatedData);
  res.status(201).json(result);
};

export const loginUser = async (req: Request, res: Response) => {
  const validatedData = loginSchema.parse(req.body);
  
  // Destrukturyzujemy wynik z serwisu
  const { user, token } = await login(validatedData);

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

export const logoutUser = async (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};