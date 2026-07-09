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

// Ghost Account flow — identifier to e-mail albo numer telefonu, rozróżniane w service.ts po
// tym, czy przechodzi walidację e-maila (patrz auth.repository.ts's findOrCreateGhostUser).
export const requestOtpSchema = z.object({
  identifier: z.string().min(3, 'Podaj e-mail lub numer telefonu'),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().min(3, 'Podaj e-mail lub numer telefonu'),
  code: z.string().length(6, 'Kod musi mieć 6 cyfr'),
});