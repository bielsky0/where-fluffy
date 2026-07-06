import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { parseCookie } from 'cookie';

let io: Server;

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const initSocket = async (httpServer: HttpServer): Promise<Server> => {
  // 1. Redis Pub/Sub wymagają dwóch niezależnych połączeń klienckich
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  // 2. Inicjalizacja serwera Socket.io z CORS i Redis Adapterem
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true, // Zezwala na przesyłanie ciasteczek sesyjnych przez WS
    },
    adapter: createAdapter(pubClient, subClient),
  });

  // 3. Middleware autentykacji dla WebSocketów (odpowiednik HTTP authenticate)
  io.use((socket, next) => {
    try {
      const cookiesHeader = socket.request.headers.cookie;
      if (!cookiesHeader) {
        return next(new Error('Authentication error: No cookies found'));
      }

      const parsedCookies = parseCookie(cookiesHeader);
      const token = parsedCookies.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Weryfikujemy token
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      
      // Zapisujemy ID użytkownika BEZPOŚREDNIO w instancji socketu
      // Dzięki temu chat.gateway.ts ma do niego stały dostęp przez socket.data.userId
      socket.data.userId = decoded.id;
      
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  return io;
};

// Funkcja pomocnicza do wyciągania instancji serwera WS w innych częściach aplikacji
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};