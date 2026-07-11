import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import petsRoutes from './modules/pets/pets.routes.js';
import chatRoutes from './modules/chat/chat.routes.js'; // <-- Nowy moduł
import locationRoutes from './modules/location/location.routes.js';
import mapRoutes from './modules/map/map.routes.js';
import seoRoutes from './modules/seo/seo.routes.js';
import geocodeRoutes from './modules/geocode/geocode.routes.js';
import searchRoutes from './modules/search/search.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/pets', petsRoutes);
apiRouter.use('/chats', chatRoutes); // Endpointy będą dostępne pod /chats
apiRouter.use('/location', locationRoutes);
apiRouter.use('/map', mapRoutes);
apiRouter.use('/seo', seoRoutes);
apiRouter.use('/geocode', geocodeRoutes);
apiRouter.use('/search', searchRoutes);

export default apiRouter;