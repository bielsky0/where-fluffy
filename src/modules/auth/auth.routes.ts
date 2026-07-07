import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { authController } from './index.js';


const router = Router();

router.post('/register', asyncHandler(authController.registerUser));
router.post('/login', asyncHandler(authController.loginUser));
router.post('/logout', asyncHandler(authController.logoutUser));

export default router;