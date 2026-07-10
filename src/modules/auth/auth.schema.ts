import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(2, 'Name is too short'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Ghost Account flow — tylko e-mail (SMS nigdy nie jest wysyłany, patrz specyfikacja
// "Bezkosztowy, Jednolity System Autoryzacji"), patrz auth.repository.ts's findOrCreateGhostUser.
export const requestOtpSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Nieprawidłowy adres e-mail'),
  code: z.string().length(6, 'Kod musi mieć 6 cyfr'),
});