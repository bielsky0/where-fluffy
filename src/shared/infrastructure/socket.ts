import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { parseCookie } from 'cookie';
import type { RedisClientType } from 'redis';
// Chat jest jedynym modułem WebSocket w tej chwili (patrz app.gateways.ts), więc kształt
// zdarzeń WS żyje w jego interfejsie. Jeśli dojdzie drugi moduł WS, te typy powinny się
// przenieść w bardziej neutralne miejsce i połączyć jako unia zdarzeń z obu modułów.
import type { ChatIoServer } from '../../modules/chat/interface/chat.interface.js';
import { createSocketConnectionRateLimiter } from '../rate-limit/rate-limiter.socket.js';
import { JWT_SECRET } from '../config/auth.config.js';

let io: ChatIoServer;

// Przyjmujemy pub/sub jako argumenty! `redisClient` (ogólnego przeznaczenia, NIE pub/sub) trafia
// tu osobno wyłącznie dla rate-limitera połączeń — patrz rate-limiter.socket.ts i CLAUDE.md
// "Rate limiting" o tym, dlaczego nie można reużyć pubClient/subClient do tego celu.
export const initSocket = (
  httpServer: HttpServer,
  pubClient: RedisClientType,
  subClient: RedisClientType,
  redisClient: RedisClientType,
): ChatIoServer => {

  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
    adapter: createAdapter(pubClient, subClient), // Wpinamy adapter
  });

  // Limit prób połączenia per IP, ZANIM zweryfikujemy JWT poniżej — tania, pierwsza linia
  // obrony przed zalewem handshake'ów (celowo przed middleware'em JWT, nie po).
  io.use(
    createSocketConnectionRateLimiter(redisClient, {
      keyPrefix: 'rl:ws:conn',
      points: 5,
      duration: 10,
      blockDuration: 60,
    }),
  );

  io.use((socket, next) => {
    try {
      const cookiesHeader = socket.request.headers.cookie;
      if (!cookiesHeader) throw new Error('No cookies');
      
      const token = parseCookie(cookiesHeader).token;
      if (!token) throw new Error('Token missing');
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email?: string; name?: string };
      // Zachowujemy pełne dane użytkownika oraz skrócone userId dla kompatybilności
      socket.data.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
      };
      socket.data.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Auth error'));
    }
  });

  return io;
};

export const getIO = (): ChatIoServer => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};