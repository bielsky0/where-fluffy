import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../shared/middleware/validate.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { commentsController } from '../comments/index.js';
import { feedController } from '../feed/index.js';
import { urgentFeedQuerySchema, feedQuerySchema } from '../feed/feed.schema.js';
import { petsController } from './index.js';
import { createPetSchema, updatePetSchema, updatePetStatusSchema } from './pets.schema.js';
import { similarPetsQuerySchema } from './similar-pets.schema.js';
import { createCommentSchema } from '../comments/comments.schema.js';

const router = Router();

// --- Trasy Zwierzaków ---
router.get('/nearby', asyncHandler(petsController.listNearby));
router.post('/', authenticate, validate(createPetSchema), asyncHandler(petsController.create));

// PRYWATNE: własne zgłoszenia zalogowanego użytkownika. Literalny segment — musi być
// zarejestrowany przed catch-allem /:petId poniżej (ten sam powód co /nearby/feed/urgent/feed),
// inaczej GET /pets/mine trafiłby w getById z petId = "mine".
router.get('/mine', authenticate, asyncHandler(petsController.listMine));

// --- Trasy Feedu (moduł feed, zagnieżdżony pod /pets — ten sam wzorzec co comments poniżej) ---
router.get('/feed/urgent', validateQuery(urgentFeedQuerySchema), asyncHandler(feedController.urgent));
router.get('/feed', validateQuery(feedQuerySchema), asyncHandler(feedController.list));

// PUBLICZNE: szczegóły pojedynczego zgłoszenia. Musi być zarejestrowane po powyższym bloku
// (/nearby, /mine, /feed/urgent, /feed) — to wszystko literalne segmenty, ale /:petId jest jednosegmentowym
// catch-allem, który by je przesłonił, gdyby stał wcześniej (Express dopasowuje trasy w kolejności
// rejestracji).
router.get('/:petId', asyncHandler(petsController.getById));

// PRYWATNE: edycja/zmiana statusu/usunięcie własnego zgłoszenia (Management Hub — patrz
// web/src/modules/profile/components/ManagementHubSheet.tsx). Ownership sprawdzany w
// pets.service.ts, nie tutaj — authenticate tylko potwierdza tożsamość, nie własność zasobu.
router.patch('/:petId', authenticate, validate(updatePetSchema), asyncHandler(petsController.update));
router.patch('/:petId/status', authenticate, validate(updatePetStatusSchema), asyncHandler(petsController.updateStatus));
router.delete('/:petId', authenticate, asyncHandler(petsController.remove));

// --- Trasy Komentarzy / Sighting Points (Zagnieżdżone RESTowo) ---

// PUBLICZNE: Każdy może zobaczyć wskazówki i komentarze pod zaginionym psem
router.get('/:petId/comments', asyncHandler(commentsController.listForPet));

// PRYWATNE: Tylko zalogowany może dodać nowy punkt widzenia / komentarz
router.post('/:petId/comments', authenticate, validate(createCommentSchema), asyncHandler(commentsController.create));

// PUBLICZNE: "Podobne zwierzęta w okolicy" (PetDetailPage.tsx). Bardziej specyficzna
// dwusegmentowa ścieżka niż catch-all /:petId powyżej — Express dopasuje ją poprawnie niezależnie
// od kolejności rejestracji względem GET /:petId (nie koliduje z PATCH/DELETE /:petId).
router.get('/:petId/similar', validateQuery(similarPetsQuerySchema), asyncHandler(petsController.getSimilar));

export default router;