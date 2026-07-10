import { Response } from 'express';

export const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // Blokuje dostęp z poziomu JS (ochrona XSS)
  secure: process.env.NODE_ENV === 'production', // Wymaga HTTPS na produkcji
  sameSite: 'lax' as const, // Ochrona przed CSRF
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Wspólne dla wszystkich sposobów zakładania sesji (hasło, OTP, OAuth) — patrz
// auth.controller.ts i auth.oauth.controller.ts, oba wywołują to zamiast dublować res.cookie.
export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie('token', token, { ...TOKEN_COOKIE_OPTIONS, maxAge: ONE_DAY_MS });
};
