import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import cookieParser from 'cookie-parser';
import apiRouter from './app.routes.js'; // <-- Import agregatora
import { errorHandler } from './shared/middleware/error.middleware.js';

export const createApp = () => {
  const app = express();
  
  app.use(pinoHttp());
  
  // Konfiguracja CORS z obsługą ciasteczek (ważne dla JWT w cookies!)
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
  
  app.use(express.json());
  app.use(cookieParser());

  // Rejestracja wszystkich tras przez jeden agregator pod prefiksem /api/v1
  // (Dzięki temu masz ładne: /api/v1/auth, /api/v1/pets, /api/v1/chats)
  app.use('/api/v1', apiRouter);

  app.use(errorHandler);

  return app;
};