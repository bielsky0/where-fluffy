import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { zodErrorToAppError } from './validate.js';

// Sibling to validate.ts, but CANNOT mirror its "replace req.X in place" pattern: in Express 5
// (installed here, 5.2.1), req.query is defined via a getter-only accessor with no setter
// (node_modules/express/lib/request.js:217, defineGetter(req, 'query', ...)) — `req.query = X`
// throws `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter`
// at runtime. So the parsed result is attached to a new `validatedQuery` property instead of
// overwriting `req.query`; controllers read `(req as ValidatedQueryRequest<T>).validatedQuery`,
// with a comment at the cast site — same convention pets.controller.ts already uses for
// `req.body as ...`.
export interface ValidatedQueryRequest<T> extends Request {
  validatedQuery: T;
}

export const validateQuery =
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(zodErrorToAppError(result.error));
      return;
    }

    (req as ValidatedQueryRequest<T>).validatedQuery = result.data;
    next();
  };
