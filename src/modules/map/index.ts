import { prisma } from '../../shared/prisma.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { createMapRepository } from './map.repository.js';
import { createMapService } from './map.service.js';
import { createMapController } from './map.controller.js';

export const mapRepository = createMapRepository(prisma);
export const mapService = createMapService(mapRepository, redisClient);
export const mapController = createMapController(mapService);
