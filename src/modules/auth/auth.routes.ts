import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { registerUser, loginUser, logoutUser } from './auth.controller.js';


const router = Router();

router.post('/register', asyncHandler(registerUser));
router.post('/login', asyncHandler(loginUser));
router.post('/logout', asyncHandler(logoutUser));

export default router;