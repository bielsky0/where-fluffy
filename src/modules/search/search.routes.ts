import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { searchController } from './index.js';
import { searchPetsQuerySchema } from './search.schema.js';

const router = Router();

// Publiczny endpoint (bez uwierzytelnienia) — tak samo jak GET /pets/nearby, przeszukiwanie
// zagubionych zwierzaków to odczyt publiczny.
router.get('/pets', validateQuery(searchPetsQuerySchema), asyncHandler(searchController.searchPets));

export default router;
