import { petsService } from '../pets/index.js';
import { createSeoService } from './seo.service.js';
import { createSeoController } from './seo.controller.js';
import { createBotGateMiddleware } from './seo.bot-gate.middleware.js';
import { oauthConfig } from '../../shared/config/oauth.config.js';

export const seoService = createSeoService(petsService, oauthConfig.frontendUrl);
export const seoController = createSeoController(seoService);
export const botGateMiddleware = createBotGateMiddleware(seoController);
