import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { listForPet } from '../comments/comments.controller.js';
import { petsController } from './index.js';


const router = Router();

// --- Trasy Zwierzaków ---
router.get('/nearby', asyncHandler(petsController.listNearby));
router.post('/', authenticate, asyncHandler(petsController.create));

// --- Trasy Komentarzy / Sighting Points (Zagnieżdżone RESTowo) ---

// PUBLICZNE: Każdy może zobaczyć wskazówki i komentarze pod zaginionym psem
router.get('/:petId/comments', asyncHandler(listForPet));

// PRYWATNE: Tylko zalogowany może dodać nowy punkt widzenia / komentarz
router.post('/:petId/comments', authenticate, asyncHandler(petsController.create));

export default router;