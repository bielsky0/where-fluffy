import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { parseCookie } from 'cookie';
import type { RedisClientType } from 'redis';

let io: Server;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// Przyjmujemy pub/sub jako argumenty!
export const initSocket = (
  httpServer: HttpServer, 
  pubClient: RedisClientType, 
  subClient: RedisClientType
): Server => {

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

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};