import { createChatService } from './chat.service.js';
import { ChatPresenceStore, ChatRepository } from './interface/chat.interface.js';
import {
  buildChatRoom,
  buildChatRoomWithRelations,
  buildMessageWithSender,
  buildMockPresenceStore,
  buildMockRepository,
  buildPetLookup,
} from './chat.test-helpers.js';

describe('createChatService', () => {
  let mockRepository: jest.Mocked<ChatRepository>;
  let mockPresenceStore: jest.Mocked<ChatPresenceStore>;

  beforeEach(() => {
    mockRepository = buildMockRepository();
    mockPresenceStore = buildMockPresenceStore();
  });

  describe('getActiveChats', () => {
    it('picks the finder as interlocutor when the caller is the room owner', async () => {
      const room = buildChatRoomWithRelations({
        ownerId: 'owner-1',
        finderId: 'finder-1',
        owner: { id: 'owner-1', name: 'Owner' },
        finder: { id: 'finder-1', name: 'Finder' },
        messages: [{ text: 'hi', createdAt: new Date('2026-01-01T12:00:00.000Z'), sender: { name: 'Finder' } }],
      });
      mockRepository.getUserRooms.mockResolvedValue([room]);
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.getActiveChats('owner-1');

      expect(mockRepository.getUserRooms).toHaveBeenCalledWith('owner-1');
      expect(result).toEqual([
        {
          roomId: room.id,
          pet: room.pet,
          interlocutor: { id: 'finder-1', name: 'Finder' },
          lastMessage: { text: 'hi', senderName: 'Finder', createdAt: '2026-01-01T12:00:00.000Z' },
        },
      ]);
    });

    it('picks the owner as interlocutor when the caller is the finder, and returns null lastMessage when there is none', async () => {
      const room = buildChatRoomWithRelations({ ownerId: 'owner-1', finderId: 'finder-1', messages: [] });
      mockRepository.getUserRooms.mockResolvedValue([room]);
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.getActiveChats('finder-1');

      expect(result[0].interlocutor).toEqual({ id: 'owner-1', name: room.owner.name });
      expect(result[0].lastMessage).toBeNull();
    });
  });

  describe('getChatHistory', () => {
    it('fetches and maps room messages', async () => {
      mockRepository.getRoomMessages.mockResolvedValue([buildMessageWithSender({ id: 'message-1' })]);
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.getChatHistory('room-1');

      expect(mockRepository.getRoomMessages).toHaveBeenCalledWith('room-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('message-1');
    });
  });

  describe('joinChatRoom', () => {
    it('throws PET_NOT_FOUND when the pet does not exist, without touching chat rooms', async () => {
      mockRepository.findPetById.mockResolvedValue(null);
      const service = createChatService(mockRepository, mockPresenceStore);

      await expect(service.joinChatRoom('user-1', 'pet-1', 'finder-1')).rejects.toThrow('PET_NOT_FOUND');
      expect(mockRepository.findChatRoomByKey).not.toHaveBeenCalled();
      expect(mockPresenceStore.grantUserAccess).not.toHaveBeenCalled();
    });

    it('throws UNAUTHORIZED when the caller is neither the pet owner nor the given finder', async () => {
      mockRepository.findPetById.mockResolvedValue(buildPetLookup({ ownerId: 'owner-1' }));
      const service = createChatService(mockRepository, mockPresenceStore);

      await expect(service.joinChatRoom('stranger', 'pet-1', 'finder-1')).rejects.toThrow('UNAUTHORIZED');
      expect(mockRepository.findChatRoomByKey).not.toHaveBeenCalled();
      expect(mockPresenceStore.grantUserAccess).not.toHaveBeenCalled();
    });

    it('reuses an existing chat room instead of creating a new one', async () => {
      mockRepository.findPetById.mockResolvedValue(buildPetLookup({ ownerId: 'owner-1' }));
      mockRepository.findChatRoomByKey.mockResolvedValue(buildChatRoom({ id: 'existing-room' }));
      mockRepository.getRoomMessages.mockResolvedValue([]);
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.joinChatRoom('owner-1', 'pet-1', 'finder-1');

      expect(mockRepository.createChatRoom).not.toHaveBeenCalled();
      expect(result.roomId).toBe('existing-room');
    });

    it('creates a new chat room when none exists yet', async () => {
      mockRepository.findPetById.mockResolvedValue(buildPetLookup({ ownerId: 'owner-1' }));
      mockRepository.findChatRoomByKey.mockResolvedValue(null);
      mockRepository.createChatRoom.mockResolvedValue(buildChatRoom({ id: 'new-room' }));
      mockRepository.getRoomMessages.mockResolvedValue([]);
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.joinChatRoom('owner-1', 'pet-1', 'finder-1');

      expect(mockRepository.createChatRoom).toHaveBeenCalledWith('pet-1', 'owner-1', 'finder-1');
      expect(result.roomId).toBe('new-room');
    });

    it('grants Redis access for the resolved room and returns mapped history', async () => {
      mockRepository.findPetById.mockResolvedValue(buildPetLookup({ ownerId: 'owner-1' }));
      mockRepository.findChatRoomByKey.mockResolvedValue(buildChatRoom({ id: 'room-1' }));
      mockRepository.getRoomMessages.mockResolvedValue([buildMessageWithSender({ chatRoomId: 'room-1' })]);
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.joinChatRoom('owner-1', 'pet-1', 'finder-1');

      expect(mockPresenceStore.grantUserAccess).toHaveBeenCalledWith('owner-1', 'room-1');
      expect(result.history).toHaveLength(1);
      expect(result.history[0].chatRoomId).toBe('room-1');
    });
  });

  describe('sendMessage', () => {
    it('throws FORBIDDEN and never persists when the caller has no Redis-granted access', async () => {
      mockPresenceStore.checkUserAccess.mockResolvedValue(false);
      const service = createChatService(mockRepository, mockPresenceStore);

      await expect(service.sendMessage('user-1', 'room-1', 'hi')).rejects.toThrow('FORBIDDEN');
      expect(mockRepository.createMessage).not.toHaveBeenCalled();
    });

    it('checks access before persisting, then returns the mapped message', async () => {
      mockPresenceStore.checkUserAccess.mockResolvedValue(true);
      mockRepository.createMessage.mockResolvedValue(buildMessageWithSender({ id: 'msg-99', text: 'hi' }));
      const service = createChatService(mockRepository, mockPresenceStore);

      const result = await service.sendMessage('user-1', 'room-1', 'hi');

      expect(mockPresenceStore.checkUserAccess).toHaveBeenCalledWith('user-1', 'room-1');
      expect(mockRepository.createMessage).toHaveBeenCalledWith('room-1', 'user-1', 'hi');
      expect(result.id).toBe('msg-99');
      expect(result.text).toBe('hi');
    });
  });

  describe('markUserOnline / markUserOffline', () => {
    it('delegates directly to the presence store', async () => {
      const service = createChatService(mockRepository, mockPresenceStore);

      await service.markUserOnline('user-1', 'socket-1');
      await service.markUserOffline('user-1');

      expect(mockPresenceStore.setUserOnline).toHaveBeenCalledWith('user-1', 'socket-1');
      expect(mockPresenceStore.setUserOffline).toHaveBeenCalledWith('user-1');
    });
  });
});
