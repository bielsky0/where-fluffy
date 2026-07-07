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

let io: ChatIoServer;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// Przyjmujemy pub/sub jako argumenty!
export const initSocket = (
  httpServer: HttpServer,
  pubClient: RedisClientType,
  subClient: RedisClientType
): ChatIoServer => {

  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
    adapter: createAdapter(pubClient, subClient), // Wpinamy adapter
  });

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