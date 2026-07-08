import { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import type { RedisClientType } from 'redis';
import { createAppError } from '../errors/app-error.js';
import { RateLimiterOptions } from './rate-limiter.types.js';

// Domyślnie limitujemy po IP. Wstrzykiwalne przez trzeci argument, żeby ta sama fabryka mogła
// limitować per zalogowany użytkownik (np. req.user!.id) na trasach za `authenticate`.
export type RateLimitKeyResolver = (req: Request) => string;

const resolveByIp: RateLimitKeyResolver = (req) => req.ip ?? 'unknown';

// FUNCTIONAL DI: fabryka domyka się nad `redisClient` i `options`, zwraca gotowy middleware
// Express. `redisClient` MUSI być zwykłym, ogólnego przeznaczenia klientem `redis` (node-redis)
// — NIE `pubClient`/`subClient` używanymi przez @socket.io/redis-adapter. W node-redis v4+
// klient wpięty w tryb subskrybenta (pub/sub) nie przyjmuje już zwykłych komend (EVAL/MULTI),
// więc rate-limiter-flexible potrzebuje osobnego, "zwykłego" połączenia — patrz
// shared/infrastructure/redis.ts's `redisClient` (ten sam, którego używa np. chat.presence.ts).
export const createRateLimiterMiddleware = (
  redisClient: RedisClientType,
  options: RateLimiterOptions,
  resolveKey: RateLimitKeyResolver = resolveByIp,
) => {
  const limiter = new RateLimiterRedis({
    storeClient: redisClient,
    // Wymagane jawnie dla node-redis (pakiet `redis`) — rate-limiter-flexible domyślnie
    // rozpoznaje automatycznie tylko ioredis (po `client.constructor.name === 'Commander'`).
    useRedisPackage: true,
    keyPrefix: options.keyPrefix,
    points: options.points,
    duration: options.duration,
    blockDuration: options.blockDuration,
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = resolveKey(req);

    try {
      await limiter.consume(key);
      next();
    } catch (rejection) {
      // rate-limiter-flexible odrzuca promise z RateLimiterRes (limit przekroczony) LUB
      // z prawdziwym Error (np. Redis padł) — te dwa przypadki trzeba rozróżnić.
      if (rejection instanceof Error) {
        next(rejection); // infrastruktura padła — nie blokujemy ruchu, error.middleware.ts zrobi z tego 500
        return;
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((rejection as RateLimiterRes).msBeforeNext / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      next(createAppError(429, `Zbyt wiele żądań. Spróbuj ponownie za ${retryAfterSeconds}s.`));
    }
  };
};
