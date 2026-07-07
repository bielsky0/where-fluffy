import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { AppError, createAppError } from '../errors/app-error.js';

export type ValidationAppError = AppError & { details: ZodError['issues'] };

export const isValidationAppError = (err: AppError): err is ValidationAppError =>
  Array.isArray((err as ValidationAppError).details);

export const zodErrorToAppError = (error: ZodError): ValidationAppError => {
  const appError = createAppError(400, 'Validation failed') as ValidationAppError;
  appError.details = error.issues;
  return appError;
};

// Waliduje req.body wg. schematu Zod i podmienia je na sparsowane dane — kontroler dostaje
// już zwalidowany DTO, bez ponownego wywoływania schema.parse() w środku.
export const validate =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(zodErrorToAppError(result.error));
      return;
    }

    req.body = result.data;
    next();
  };
