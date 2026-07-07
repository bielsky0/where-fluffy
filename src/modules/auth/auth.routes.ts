import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { validate } from '../../shared/middleware/validate.js';
import { authController } from './index.js';
import { loginSchema, registerSchema } from './auth.schema.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.registerUser));
router.post('/login', validate(loginSchema), asyncHandler(authController.loginUser));
router.post('/logout', asyncHandler(authController.logoutUser));

export default router;