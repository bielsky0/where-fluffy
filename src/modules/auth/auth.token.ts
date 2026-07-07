import jwt from 'jsonwebtoken';
import { TokenPayload, TokenService } from './interface/auth.interface.js';

export const createJwtTokenService = (secret: string, expiresIn: jwt.SignOptions['expiresIn'] = '1d'): TokenService => ({
  sign: (payload: TokenPayload) => jwt.sign(payload, secret, { expiresIn }),
});
