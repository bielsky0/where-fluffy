import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => 
  (req: Request, res: Response, next: NextFunction) => {
    // Express 5 automatycznie wyłapie błąd z promise, 
    // ale ten wrapper daje nam pewność i czytelność.
    Promise.resolve(fn(req, res, next)).catch(next);
  };