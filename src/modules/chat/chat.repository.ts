import type { PrismaClient } from '@prisma/client';
import { ChatPetLookup, ChatRepository, ChatRoomWithRelations, IChatRoom, MessageWithSender } from './interface/chat.interface.js';

export const createChatRepository = (prisma: PrismaClient): ChatRepository => {
  const getUserRooms = async (userId: string): Promise<ChatRoomWithRelations[]> => {
    const rooms = await prisma.chatRoom.findMany({
      where: { OR: [{ ownerId: userId }, { finderId: userId }] },
      include: {
        pet: { select: { id: true, name: true, status: true } },
        owner: { select: { id: true, name: true } },
        finder: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rooms as ChatRoomWithRelations[];
  };

  const getRoomMessages = async (roomId: string): Promise<MessageWithSender[]> => {
    const messages = await prisma.message.findMany({
      where: { chatRoomId: roomId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true } } },
    });
    return messages as MessageWithSender[];
  };

  const findPetById = async (id: string): Promise<ChatPetLookup | null> => {
    return prisma.pet.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
  };

  const findChatRoomByKey = async (petId: string, ownerId: string, finderId: string): Promise<IChatRoom | null> => {
    return prisma.chatRoom.findUnique({
      where: {
        petId_ownerId_finderId: { petId, ownerId, finderId },
      },
    });
  };

  const createChatRoom = async (petId: string, ownerId: string, finderId: string): Promise<IChatRoom> => {
    return prisma.chatRoom.create({
      data: { petId, ownerId, finderId },
    });
  };

  const createMessage = async (chatRoomId: string, senderId: string, text: string): Promise<MessageWithSender> => {
    const message = await prisma.message.create({
      data: { chatRoomId, senderId, text },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });
    return message as MessageWithSender;
  };

  return { getUserRooms, getRoomMessages, findPetById, findChatRoomByKey, createChatRoom, createMessage };
};
