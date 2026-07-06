import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import petsRoutes from './modules/pets/pets.routes.js';
import chatRoutes from './modules/chat/chat.routes.js'; // <-- Nowy moduł

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/pets', petsRoutes);
apiRouter.use('/chats', chatRoutes); // Endpointy będą dostępne pod /chats

export default apiRouter;