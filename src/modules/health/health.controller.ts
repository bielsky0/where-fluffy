import { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';
import { redisClient } from '../../shared/infrastructure/redis.js';

// Nie ma tu warstwy service/repository — to tylko sprawdzenie, czy Postgres i Redis realnie
// odpowiadają (nie tylko czy proces API żyje), więc pinguje obie zależności bezpośrednio zamiast
// przechodzić przez pełny stos routes -> controller -> service -> repository innych modułów.
export const healthCheck = async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redisClient.ping();
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
};
