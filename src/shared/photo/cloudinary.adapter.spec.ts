import { createCloudinaryImageStorageProvider } from './cloudinary.adapter.js';
import { CloudinaryConfig } from '../config/cloudinary.config.js';

const mockUpload = jest.fn();
const mockDestroy = jest.fn();
const mockConfig = jest.fn();

jest.mock('cloudinary', () => ({
  v2: {
    config: (...args: unknown[]) => mockConfig(...args),
    uploader: {
      upload: (...args: unknown[]) => mockUpload(...args),
      destroy: (...args: unknown[]) => mockDestroy(...args),
    },
  },
}));

const testConfig: CloudinaryConfig = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
};

describe('createCloudinaryImageStorageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures the Cloudinary SDK with the injected credentials', () => {
    createCloudinaryImageStorageProvider(testConfig);

    expect(mockConfig).toHaveBeenCalledWith({
      cloud_name: 'demo',
      api_key: 'key',
      api_secret: 'secret',
    });
  });

  describe('upload', () => {
    it('uploads the base64 image with optimization transforms and returns the secure URL', async () => {
      mockUpload.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1700000000/pets/abc123.webp',
      });
      const provider = createCloudinaryImageStorageProvider(testConfig);

      const url = await provider.upload('data:image/jpeg;base64,AAA');

      expect(mockUpload).toHaveBeenCalledWith('data:image/jpeg;base64,AAA', {
        folder: 'pets',
        quality: 'auto',
        fetch_format: 'auto',
        transformation: [{ width: 1080, crop: 'limit' }],
      });
      expect(url).toBe('https://res.cloudinary.com/demo/image/upload/v1700000000/pets/abc123.webp');
    });
  });

  describe('remove', () => {
    it('extracts the public_id from a Cloudinary URL and destroys it', async () => {
      const provider = createCloudinaryImageStorageProvider(testConfig);

      await provider.remove('https://res.cloudinary.com/demo/image/upload/v1700000000/pets/abc123.webp');

      expect(mockDestroy).toHaveBeenCalledWith('pets/abc123');
    });

    it('safely no-ops on a non-Cloudinary URL (e.g. a legacy base64 data URL from before this migration)', async () => {
      const provider = createCloudinaryImageStorageProvider(testConfig);

      await provider.remove('data:image/jpeg;base64,AAA');

      expect(mockDestroy).not.toHaveBeenCalled();
    });
  });
});
