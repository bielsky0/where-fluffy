import { createLocationRepository } from './location.repository.js';
import { createLocationService } from './location.service.js';
import { createLocationController } from './location.controller.js';

export const locationRepository = createLocationRepository();
export const locationService = createLocationService(locationRepository);
export const locationController = createLocationController(locationService);
