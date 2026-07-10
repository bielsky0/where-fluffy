import { redisClient } from '../../shared/infrastructure/redis.js';
import { createGeocodeRepository } from './geocode.repository.js';
import { createGeocodeService } from './geocode.service.js';
import { createGeocodeController } from './geocode.controller.js';

export const geocodeRepository = createGeocodeRepository();
export const geocodeService = createGeocodeService(geocodeRepository, redisClient);
export const geocodeController = createGeocodeController(geocodeService);
