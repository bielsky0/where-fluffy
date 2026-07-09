import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import cookieParser from 'cookie-parser';
import apiRouter from './app.routes.js'; // <-- Import agregatora
import { errorHandler } from './shared/middleware/error.middleware.js';
import { createRateLimiterMiddleware } from './shared/rate-limit/rate-limiter.middleware.js';
import { redisClient } from './shared/infrastructure/redis.js';
import { logger } from './shared/infrastructure/logger.js';

export const createApp = () => {
  const app = express();

  // Reuses the same `logger` instance every service/gateway imports directly (see
  // chat.service.ts) — its trace_id/span_id mixin then applies uniformly to both request logs
  // and manual application logs, not just one or the other.
  app.use(pinoHttp({ logger }));

  // Konfiguracja CORS z obsługą ciasteczek (ważne dla JWT w cookies!)
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));

  // Domyślny limit (100kb) jest za mały na zdjęcie zakodowane jako base64 (patrz
  // shared/photo/photo.service.ts / pets.schema.ts's photoBase64) — kompresja po stronie klienta
  // (compressImage.ts) trzyma to w rozsądnych granicach, ale trzeba dać jej gdzie się zmieścić.
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  // Globalna, luźna ochrona przed nadużyciami dla całego /api/v1, per IP. Osobne, ostrzejsze
  // limity dla wrażliwych tras (np. logowania) wpina się dodatkowo tą samą fabryką z innymi
  // opcjami na poziomie konkretnej trasy — patrz auth.routes.ts.
  app.use(
    '/api/v1',
    createRateLimiterMiddleware(redisClient, { keyPrefix: 'rl:http:global', points: 100, duration: 60 }),
  );

  // Rejestracja wszystkich tras przez jeden agregator pod prefiksem /api/v1
  // (Dzięki temu masz ładne: /api/v1/auth, /api/v1/pets, /api/v1/chats)
  app.use('/api/v1', apiRouter);

  app.use(errorHandler);

  return app;
};