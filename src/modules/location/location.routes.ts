import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { locationController } from './index.js';

const router = Router();

router.get('/me', asyncHandler(locationController.me));

export default router;
