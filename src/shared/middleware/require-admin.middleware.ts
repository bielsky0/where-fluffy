import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import { createAppError } from '../errors/app-error.js';
import { ADMIN_EMAILS } from '../config/admin.config.js';

// FUNCTIONAL DI: allowlist jako parametr (domyślnie prawdziwy Set z admin.config.ts), żeby
// require-admin.middleware.spec.ts mógł wstrzyknąć własny Set zamiast mutować process.env — ta
// sama motywacja co createRateLimiterMiddleware w rate-limiter.middleware.ts. Musi biec PO
// authenticate (potrzebuje już ustawionego req.user.email) i PRZED validate(schema) —
// authenticate potwierdza tylko tożsamość, requireAdmin potwierdza autoryzację (ten sam podział co
// assertOwnership w pets.service.ts dla PATCH/DELETE własnych zgłoszeń).
export const createRequireAdmin = (adminEmails: Set<string> = ADMIN_EMAILS) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const email = req.user?.email?.toLowerCase();
    if (!email || !adminEmails.has(email)) {
      next(createAppError(403, 'Brak uprawnień administratora'));
      return;
    }
    next();
  };
};

export const requireAdmin = createRequireAdmin();
