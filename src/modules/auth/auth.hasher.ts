import { compare, hash } from 'bcrypt';
import { PasswordHasher } from './interface/auth.interface.js';

export const createBcryptPasswordHasher = (saltRounds = 10): PasswordHasher => ({
  hash: (plainText) => hash(plainText, saltRounds),
  compare: (plainText, hashedText) => compare(plainText, hashedText),
});
