import { Router } from 'express';
import { chatController } from './index.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js'; // Pomocnik do wyłapywania błędów async

const router = Router();

/**
 * Globalny middleware zabezpieczający moduł czatu.
 * Żaden anonimowy użytkownik nie ma prawa odpytać tych endpointów.
 */
router.use(authenticate);


router.get('/', asyncHandler(chatController.listUserChats));
router.get('/:roomId/messages', asyncHandler(chatController.getMessages));

export default router;