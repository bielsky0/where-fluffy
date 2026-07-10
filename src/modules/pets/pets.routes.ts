import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../shared/middleware/validate.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { commentsController } from '../comments/index.js';
import { feedController } from '../feed/index.js';
import { urgentFeedQuerySchema, feedQuerySchema } from '../feed/feed.schema.js';
import { petsController } from './index.js';
import { createPetSchema } from './pets.schema.js';
import { createCommentSchema } from '../comments/comments.schema.js';

const router = Router();

// --- Trasy Zwierzaków ---
router.get('/nearby', asyncHandler(petsController.listNearby));
router.post('/', authenticate, validate(createPetSchema), asyncHandler(petsController.create));

// --- Trasy Feedu (moduł feed, zagnieżdżony pod /pets — ten sam wzorzec co comments poniżej) ---
router.get('/feed/urgent', validateQuery(urgentFeedQuerySchema), asyncHandler(feedController.urgent));
router.get('/feed', validateQuery(feedQuerySchema), asyncHandler(feedController.list));

// PUBLICZNE: szczegóły pojedynczego zgłoszenia. Musi być zarejestrowane po powyższym bloku
// (/nearby, /feed/urgent, /feed) — to wszystko literalne segmenty, ale /:petId jest jednosegmentowym
// catch-allem, który by je przesłonił, gdyby stał wcześniej (Express dopasowuje trasy w kolejności
// rejestracji).
router.get('/:petId', asyncHandler(petsController.getById));

// --- Trasy Komentarzy / Sighting Points (Zagnieżdżone RESTowo) ---

// PUBLICZNE: Każdy może zobaczyć wskazówki i komentarze pod zaginionym psem
router.get('/:petId/comments', asyncHandler(commentsController.listForPet));

// PRYWATNE: Tylko zalogowany może dodać nowy punkt widzenia / komentarz
router.post('/:petId/comments', authenticate, validate(createCommentSchema), asyncHandler(commentsController.create));

export default router;