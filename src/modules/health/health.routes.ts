import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { healthCheck } from './health.controller.js';

const router = Router();

router.get('/', asyncHandler(healthCheck));

export default router;
