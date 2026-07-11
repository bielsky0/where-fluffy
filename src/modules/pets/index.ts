import { prisma } from '../../shared/prisma.js';
import { createPetRepository } from './pets.repository.js';
import { createPetsService } from './pets.service.js';
import { createPetsController } from './pets.controller.js';
import { createPhotoService } from '../../shared/photo/photo.service.js';
import { createGeocodingService } from '../../shared/geocoding/geocoding.service.js';
import { petEmbeddingQueue } from '../../shared/queue/index.js';

export const petsRepository = createPetRepository(prisma);
export const photoService = createPhotoService();
export const geocodingService = createGeocodingService();
export const petsService = createPetsService(petsRepository, photoService, geocodingService, petEmbeddingQueue);
export const petsController = createPetsController(petsService);
