import { prisma } from "../../shared/prisma.js";
import { redisClient } from '../../shared/infrastructure/redis.js';

export const setUserOnline = async (userId: string, socketId: string) => {
  // Przechowujemy socketId, aby wiedzieć gdzie wysyłać wiadomości
  await redisClient.set(`user:${userId}:status`, 'online');
  await redisClient.set(`user:${userId}:socket`, socketId);
};

export const setUserOffline = async (userId: string) => {
  await redisClient.del(`user:${userId}:status`);
  await redisClient.del(`user:${userId}:socket`);
};

export const grantUserAccess = async (userId: string, roomId: string) => {
  await redisClient.setEx(`access:${userId}:${roomId}`, 3600, '1');
};

export const checkUserAccess = async (userId: string, roomId: string): Promise<boolean> => {
  const access = await redisClient.get(`access:${userId}:${roomId}`);
  return access === '1';
};

// Istniejące metody dla HTTP API
export const getUserRooms = async (userId: string) => {
  return await prisma.chatRoom.findMany({
    where: { OR: [{ ownerId: userId }, { finderId: userId }] },
    include: {
      pet: { select: { id: true, name: true, status: true } },
      owner: { select: { id: true, name: true } },
      finder: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { name: true } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const getRoomMessages = async (roomId: string) => {
  return await prisma.message.findMany({
    where: { chatRoomId: roomId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true } } }
  });
};

// --- NOWE METODY DLA GATEWAYA ---

export const findPetById = async (id: string) => {
  return await prisma.pet.findUnique({
    where: { id }
  });
};

export const findChatRoomByKey = async (petId: string, ownerId: string, finderId: string) => {
  return await prisma.chatRoom.findUnique({
    where: {
      petId_ownerId_finderId: { petId, ownerId, finderId }
    }
  });
};

export const createChatRoom = async (petId: string, ownerId: string, finderId: string) => {
  return await prisma.chatRoom.create({
    data: { petId, ownerId, finderId }
  });
};

export const findChatRoomById = async (id: string) => {
  return await prisma.chatRoom.findUnique({
    where: { id }
  });
};

export const createMessage = async (chatRoomId: string, senderId: string, text: string) => {
  return await prisma.message.create({
    data: { chatRoomId, senderId, text },
    include: {
      sender: { select: { id: true, name: true } }
    }
  });
};