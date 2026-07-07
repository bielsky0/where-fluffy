import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../errors/app-error.js';
import { isValidationAppError, zodErrorToAppError } from './validate.js';

// Jedyny globalny error handler. Wszystko przechodzi przez AppError (patrz shared/errors/app-error.ts):
// operacyjne błędy (isOperational: true) trafiają do klienta ze swoim statusCode/message,
// wszystko inne (błędy programistyczne, nieoczekiwane wyjątki) loguje pełny stack trace
// i zwraca generyczne 500 bez wycieku szczegółów implementacji.
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  // Zabezpieczenie na wypadek gdyby ZodError dotarł tu bezpośrednio (np. ktoś wywoła
  // schema.parse() poza middleware'em validate()) — normalizujemy tą samą ścieżką co validate().
  const normalized = err instanceof ZodError ? zodErrorToAppError(err) : err;

  if (isAppError(normalized) && normalized.isOperational) {
    const details = isValidationAppError(normalized) ? { errors: normalized.details } : {};
    res.status(normalized.statusCode).json({ status: 'error', message: normalized.message, ...details });
    return;
  }

  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ status: 'error', message: 'Internal server error' });
};