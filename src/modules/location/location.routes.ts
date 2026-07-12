import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { locationController } from './index.js';
import { locationMeQuerySchema } from './location.schema.js';

const router = Router();

router.get('/me', validateQuery(locationMeQuerySchema), asyncHandler(locationController.me));

export default router;
