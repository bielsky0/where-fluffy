import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Tworzymy instancję klienta
export const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('🔴 [Redis] Błąd:', err));
redisClient.on('ready', () => console.log('🟢 [Redis] Połączono'));

export const initRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};