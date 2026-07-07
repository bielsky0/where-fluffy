// Współdzielone mocki/fixture'y dla chat.service.spec.ts i chat.gateway.spec.ts.
// Nazwa celowo NIE pasuje do wzorca *.spec.ts / *.test.ts, więc Jest jej nie traktuje
// jako osobnej suity testów.
import { ChatPresenceStore, ChatRepository, ChatRoomWithRelations, IChatRoom, MessageWithSender, ChatPetLookup } from './interface/chat.interface.js';
import { ChatService } from './chat.service.js';

export const buildMockRepository = (): jest.Mocked<ChatRepository> => ({
  getUserRooms: jest.fn(),
  getRoomMessages: jest.fn(),
  findPetById: jest.fn(),
  findChatRoomByKey: jest.fn(),
  createChatRoom: jest.fn(),
  createMessage: jest.fn(),
});

export const buildMockPresenceStore = (): jest.Mocked<ChatPresenceStore> => ({
  setUserOnline: jest.fn(),
  setUserOffline: jest.fn(),
  grantUserAccess: jest.fn(),
  checkUserAccess: jest.fn(),
});

export const buildMockChatService = (): jest.Mocked<ChatService> => ({
  getActiveChats: jest.fn(),
  getChatHistory: jest.fn(),
  joinChatRoom: jest.fn(),
  sendMessage: jest.fn(),
  markUserOnline: jest.fn(),
  markUserOffline: jest.fn(),
});

export const buildMessageWithSender = (overrides: Partial<MessageWithSender> = {}): MessageWithSender => ({
  id: 'message-1',
  chatRoomId: 'room-1',
  text: 'Hello!',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  sender: { id: 'user-1', name: 'Jane' },
  ...overrides,
});

export const buildChatRoom = (overrides: Partial<IChatRoom> = {}): IChatRoom => ({
  id: 'room-1',
  petId: 'pet-1',
  ownerId: 'owner-1',
  finderId: 'finder-1',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  ...overrides,
});

export const buildPetLookup = (overrides: Partial<ChatPetLookup> = {}): ChatPetLookup => ({
  id: 'pet-1',
  ownerId: 'owner-1',
  ...overrides,
});

export const buildChatRoomWithRelations = (overrides: Partial<ChatRoomWithRelations> = {}): ChatRoomWithRelations => ({
  id: 'room-1',
  ownerId: 'owner-1',
  finderId: 'finder-1',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  pet: { id: 'pet-1', name: 'Rex', status: 'missing' },
  owner: { id: 'owner-1', name: 'Owner Name' },
  finder: { id: 'finder-1', name: 'Finder Name' },
  messages: [],
  ...overrides,
});
