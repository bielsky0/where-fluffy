import { prisma } from '../../shared/prisma.js';
import { createPetRepository } from './pets.repository.js';
import { createPetsService } from './pets.service.js';
import { createPetsController } from './pets.controller.js';

export const petsRepository = createPetRepository(prisma);
export const petsService = createPetsService(petsRepository);
export const petsController = createPetsController(petsService);
