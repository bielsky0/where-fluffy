import type { Event, ExtendedError, Socket } from 'socket.io';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { RedisClientType } from 'redis';
import { createAppError } from '../errors/app-error.js';
import { RateLimiterOptions } from './rate-limiter.types.js';

const buildLimiter = (redisClient: RedisClientType, options: RateLimiterOptions): RateLimiterRedis =>
  new RateLimiterRedis({
    storeClient: redisClient,
    useRedisPackage: true, // patrz rate-limiter.middleware.ts — wymagane dla node-redis
    keyPrefix: options.keyPrefix,
    points: options.points,
    duration: options.duration,
    blockDuration: options.blockDuration,
  });

const toExtendedError = async (
  limiter: RateLimiterRedis,
  key: string,
  fallbackMessage: string,
): Promise<ExtendedError | undefined> => {
  try {
    await limiter.consume(key);
    return undefined;
  } catch (rejection) {
    if (rejection instanceof Error) return rejection; // Redis padł — nie blokujemy, przepuszczamy jako realny błąd
    return createAppError(429, fallbackMessage);
  }
};

// POŁĄCZENIA (io.use): limituje próby połączenia per IP, ZANIM zostanie zweryfikowany JWT —
// tania, pierwsza linia obrony przed zalewem uchwytów połączeń (patrz
// shared/infrastructure/socket.ts, gdzie to jest zarejestrowane PRZED middleware'em JWT).
// `next(err)` na tym etapie od razu odrzuca handshake i rozłącza socket (zachowanie Socket.io
// dla io.use(), inne niż socket.use() poniżej).
export const createSocketConnectionRateLimiter = (redisClient: RedisClientType, options: RateLimiterOptions) => {
  const limiter = buildLimiter(redisClient, options);

  return async (socket: Socket, next: (err?: ExtendedError) => void): Promise<void> => {
    const ip = socket.handshake.address;
    const err = await toExtendedError(limiter, ip, 'Zbyt wiele prób połączenia. Spróbuj później.');
    next(err);
  };
};

// Typ wstrzykiwany do modułów gateway (np. createChatGateway) — celowo nieopisujący Redis/
// rate-limiter-flexible, żeby gateway (transport-only) zostawał od nich odsprzęgnięty, tak samo
// jak chat.service.ts jest odsprzęgnięty od Prisma/Redis przez ChatRepository/ChatPresenceStore.
export type SocketEventRateLimiter = (userId: string) => (event: Event, next: (err?: Error) => void) => Promise<void>;

// ZDARZENIA (socket.use): limituje częstotliwość zdarzeń JUŻ POŁĄCZONEGO, uwierzytelnionego
// socketu (join_chat/send_message/...), kluczowane po userId (nie IP — na tym etapie użytkownik
// jest już znany z JWT). Zwraca fabrykę per-użytkownik, bo `socket.use()` wpina się indywidualnie
// dla każdego socketu wewnątrz handlera 'connection' (patrz chat.gateway.ts).
//
// Ważne: w przeciwieństwie do io.use(), `next(err)` w socket.use() NIE rozłącza socketu — zgodnie
// z oficjalnym wzorcem Socket.io, emituje lokalne zdarzenie 'error' na tym sockecie, które trzeba
// samodzielnie obsłużyć (np. socket.on('error', ...) → socket.emit('error_response', ...)),
// inaczej przekroczenie limitu zostanie po cichu zignorowane.
export const createSocketEventRateLimiter = (redisClient: RedisClientType, options: RateLimiterOptions): SocketEventRateLimiter => {
  const limiter = buildLimiter(redisClient, options);

  return (userId: string) =>
    async (_event: Event, next: (err?: Error) => void): Promise<void> => {
      const err = await toExtendedError(limiter, userId, 'Zbyt wiele zdarzeń. Zwolnij.');
      next(err);
    };
};
