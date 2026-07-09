import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { mapController } from './index.js';
import { mapPinsQuerySchema } from './map.schema.js';

const router = Router();

router.get('/pins', validateQuery(mapPinsQuerySchema), asyncHandler(mapController.pins));

export default router;
