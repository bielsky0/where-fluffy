import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {parseCookie} from 'cookie';
import { JWT_SECRET } from '../config/auth.config.js';

// Rozszerzamy standardowy interfejs Request z Expressa o dane zalogowanego użytkownika
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cookiesHeader = req.headers.cookie;
    
    if (!cookiesHeader) {
      return res.status(401).json({ message: 'Brak autoryzacji: Nie znaleziono ciasteczek.' });
    }

    // Parsujemy ciasteczka z nagłówka
    const parsedCookies = parseCookie(cookiesHeader);
    const token = parsedCookies.token; // Zakładamy, że token siedzi w ciasteczku o nazwie 'token'

    if (!token) {
      return res.status(401).json({ message: 'Brak autoryzacji: Brak tokenu JWT.' });
    }

    // Weryfikacja poprawności tokenu
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id: string; email: string; name: string };
    
    // Wstrzykujemy dane użytkownika do obiektu żądania
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Brak autoryzacji: Token jest nieprawidłowy lub wygasł.' });
  }
};