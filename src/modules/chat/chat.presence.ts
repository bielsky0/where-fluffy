import type { RedisClientType } from 'redis';
import { ChatPresenceStore } from './interface/chat.interface.js';

export const createChatPresenceStore = (redisClient: RedisClientType): ChatPresenceStore => {
  const setUserOnline = async (userId: string, socketId: string): Promise<void> => {
    // Przechowujemy socketId, aby wiedzieć gdzie wysyłać wiadomości
    await redisClient.set(`user:${userId}:status`, 'online');
    await redisClient.set(`user:${userId}:socket`, socketId);
  };

  const setUserOffline = async (userId: string): Promise<void> => {
    await redisClient.del(`user:${userId}:status`);
    await redisClient.del(`user:${userId}:socket`);
  };

  const grantUserAccess = async (userId: string, roomId: string): Promise<void> => {
    await redisClient.setEx(`access:${userId}:${roomId}`, 3600, '1');
  };

  const checkUserAccess = async (userId: string, roomId: string): Promise<boolean> => {
    const access = await redisClient.get(`access:${userId}:${roomId}`);
    return access === '1';
  };

  return { setUserOnline, setUserOffline, grantUserAccess, checkUserAccess };
};
