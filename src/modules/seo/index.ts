import { petsService } from '../pets/index.js';
import { createSeoService } from './seo.service.js';
import { createSeoController } from './seo.controller.js';
import { createBotGateMiddleware } from './seo.bot-gate.middleware.js';

const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

export const seoService = createSeoService(petsService, frontendBaseUrl);
export const seoController = createSeoController(seoService);
export const botGateMiddleware = createBotGateMiddleware(seoController);
