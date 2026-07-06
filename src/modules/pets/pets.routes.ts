import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { listForPet } from '../comments/comments.controller.js';
import { create, listNearby } from './pets.controller.js';


const router = Router();

// --- Trasy Zwierzaków ---
router.get('/nearby', asyncHandler(listNearby));
router.post('/', authenticate, asyncHandler(create));

// --- Trasy Komentarzy / Sighting Points (Zagnieżdżone RESTowo) ---

// PUBLICZNE: Każdy może zobaczyć wskazówki i komentarze pod zaginionym psem
router.get('/:petId/comments', asyncHandler(listForPet));

// PRYWATNE: Tylko zalogowany może dodać nowy punkt widzenia / komentarz
router.post('/:petId/comments', authenticate, asyncHandler(create));

export default router;