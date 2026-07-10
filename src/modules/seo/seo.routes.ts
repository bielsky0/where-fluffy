import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { seoController } from './index.js';

const router = Router();

// Directly callable/testable OG-preview shell, independent of the (still-undecided) bot-gate
// mount point — see seo.bot-gate.middleware.ts. Mounted under /api/v1/seo.
router.get('/pets/:petId/preview', asyncHandler(seoController.preview));

export default router;
