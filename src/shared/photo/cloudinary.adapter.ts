import { v2 as cloudinary } from 'cloudinary';
import { ImageStorageProvider } from './image-storage.interface.js';
import { CloudinaryConfig } from '../config/cloudinary.config.js';
import { logger } from '../infrastructure/logger.js';

const UPLOAD_FOLDER = 'pets';
// Bezpiecznik po stronie serwera — frontend już skaluje do 1080px w compressImage.ts, ale to
// tylko zaufanie do klienta; każdy, kto wywoła API bezpośrednio, ominąłby ten limit bez tego.
const MAX_WIDTH = 1080;

// Wyodrębnia Cloudinary public_id z secure_url, np.
// https://res.cloudinary.com/<cloud>/image/upload/v169.../pets/abc123.webp -> "pets/abc123"
// Zwraca null dla stringów, które nie są Cloudinary URL-em — np. starych base64 data URL
// zapisanych przez poprzedni mock (photo.service.ts) przed tą migracją. remove() musi to
// bezpiecznie pominąć zamiast rzucać błąd.
const extractPublicId = (url: string): string | null => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  return match ? match[1] : null;
};

export const createCloudinaryImageStorageProvider = (config: CloudinaryConfig): ImageStorageProvider => {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
  });

  const upload = async (base64: string): Promise<string> => {
    const result = await cloudinary.uploader.upload(base64, {
      folder: UPLOAD_FOLDER,
      quality: 'auto',
      fetch_format: 'auto',
      transformation: [{ width: MAX_WIDTH, crop: 'limit' }],
    });
    return result.secure_url;
  };

  const remove = async (url: string): Promise<void> => {
    const publicId = extractPublicId(url);
    if (!publicId) {
      logger.warn({ url }, '[image-storage] nie można wyodrębnić public_id z URL, pomijam usuwanie');
      return;
    }
    await cloudinary.uploader.destroy(publicId);
  };

  return { upload, remove };
};
