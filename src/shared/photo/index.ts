import { createCloudinaryImageStorageProvider } from './cloudinary.adapter.js';
import { cloudinaryConfig } from '../config/cloudinary.config.js';

export const imageStorageProvider = createCloudinaryImageStorageProvider(cloudinaryConfig);
