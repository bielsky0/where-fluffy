import { prisma } from '../../shared/prisma.js';
import { petsRepository } from '../pets/index.js';
import { createCommentsRepository } from './comments.repository.js';
import { createCommentsService } from './comments.service.js';
import { createCommentsController } from './comments.controller.js';

export const commentsRepository = createCommentsRepository(prisma);
export const commentsService = createCommentsService(commentsRepository, petsRepository);
export const commentsController = createCommentsController(commentsService);
