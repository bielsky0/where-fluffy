import { prisma } from '../../shared/prisma.js';
import { petsRepository } from '../pets/index.js';
import { createFeedRepository } from './feed.repository.js';
import { createFeedService } from './feed.service.js';
import { createFeedController } from './feed.controller.js';

export const feedRepository = createFeedRepository(prisma);
export const feedService = createFeedService(feedRepository, petsRepository);
export const feedController = createFeedController(feedService);
