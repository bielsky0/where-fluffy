import { prisma } from '../../shared/prisma.js';
import { createPetRepository } from './pets.repository.js';
import { createPetsService } from './pets.service.js';
import { createPetsController } from './pets.controller.js';
import { createPhotoService } from '../../shared/photo/photo.service.js';

export const petsRepository = createPetRepository(prisma);
export const photoService = createPhotoService();
export const petsService = createPetsService(petsRepository, photoService);
export const petsController = createPetsController(petsService);
