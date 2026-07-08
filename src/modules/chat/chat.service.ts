import { ChatListResponseDTO } from './dto/chat-list-response.dto.js';
import { MessageResponseDTO } from './dto/message-response.dto.js';
import { ChatPresenceStore, ChatRepository, ChatRoomWithRelations, MessageWithSender } from './interface/chat.interface.js';
import { logger } from '../../shared/infrastructure/logger.js';

/**
 * Prywatny mapper przekształcający surowy pokój z bazy danych na DTO listy czatów.
 * Automatycznie wylicza, kto dla zalogowanego użytkownika jest "rozmówcą" (interlocutor).
 */
const mapToChatListDTO = (room: ChatRoomWithRelations, userId: string): ChatListResponseDTO => {
  // Jeśli zalogowany użytkownik to właściciel (owner), to jego rozmówcą jest znalazca (finder) i odwrotnie
  const interlocutor = room.ownerId === userId ? room.finder : room.owner;
  const lastMessage = room.messages?.[0];

  return {
    roomId: room.id,
    pet: {
      id: room.pet.id,
      name: room.pet.name,
      status: room.pet.status,
    },
    interlocutor: {
      id: interlocutor.id,
      name: interlocutor.name,
    },
    lastMessage: lastMessage ? {
      text: lastMessage.text,
      senderName: lastMessage.sender.name,
      createdAt: lastMessage.createdAt.toISOString(),
    } : null,
  };
};

/**
 * Publiczny mapper przekształcający surową wiadomość z bazy danych na ujednolicone DTO.
 * Wykorzystywany zarówno przy odpowiedzi HTTP, jak i przy emisji zdarzeń WebSocket.
 */
export const mapToMessageDTO = (message: MessageWithSender): MessageResponseDTO => {
  return {
    id: message.id,
    chatRoomId: message.chatRoomId,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    sender: {
      id: message.sender.id,
      name: message.sender.name,
    },
  };
};

export type ChatService = {
  getActiveChats: (userId: string) => Promise<ChatListResponseDTO[]>;
  getChatHistory: (roomId: string) => Promise<MessageResponseDTO[]>;
  joinChatRoom: (userId: string, petId: string, finderId: string) => Promise<{ roomId: string; history: MessageResponseDTO[] }>;
  sendMessage: (userId: string, chatRoomId: string, text: string) => Promise<MessageResponseDTO>;
  markUserOnline: (userId: string, socketId: string) => Promise<void>;
  markUserOffline: (userId: string) => Promise<void>;
};

export const createChatService = (repository: ChatRepository, presenceStore: ChatPresenceStore): ChatService => {
  /**
   * Pobiera listę wszystkich aktywnych konwersacji powiązanych z danym użytkownikiem.
   */
  const getActiveChats = async (userId: string): Promise<ChatListResponseDTO[]> => {
    const rooms = await repository.getUserRooms(userId);
    return rooms.map((room) => mapToChatListDTO(room, userId));
  };

  /**
   * Pobiera pełną historię wiadomości dla konkretnego pokoju czatu.
   */
  const getChatHistory = async (roomId: string): Promise<MessageResponseDTO[]> => {
    const messages = await repository.getRoomMessages(roomId);
    return messages.map(mapToMessageDTO);
  };

  const joinChatRoom = async (userId: string, petId: string, finderId: string) => {
    const pet = await repository.findPetById(petId);
    if (!pet) throw new Error('PET_NOT_FOUND');

    if (userId !== pet.ownerId && userId !== finderId) {
      throw new Error('UNAUTHORIZED');
    }

    let chatRoom = await repository.findChatRoomByKey(petId, pet.ownerId, finderId);
    if (!chatRoom) {
      chatRoom = await repository.createChatRoom(petId, pet.ownerId, finderId);
    }

    // Zapisujemy dostęp w Redis (czas trwania: 1 godzina) — patrz CLAUDE.md
    // "Chat access control (Redis as the trust boundary)": to jedyny moment, w którym
    // sprawdzamy uprawnienia w SQL; każdy kolejny send_message ufa już tylko temu wpisowi.
    await presenceStore.grantUserAccess(userId, chatRoom.id);

    const history = await repository.getRoomMessages(chatRoom.id);

    return {
      roomId: chatRoom.id,
      history: history.map(mapToMessageDTO),
    };
  };

  const sendMessage = async (userId: string, chatRoomId: string, text: string): Promise<MessageResponseDTO> => {
    // ✅ KLUCZOWY MOMENT: sprawdzamy dostęp w REDIS, nie w SQL!
    const hasAccess = await presenceStore.checkUserAccess(userId, chatRoomId);
    if (!hasAccess) {
      // `logger` needs no trace id passed in — its mixin() (logger.ts) reads whichever span
      // is active on this call stack (the WS event's span, thanks to auto-instrumentation)
      // and stamps trace_id/span_id on this line automatically, so it shows up correlated
      // next to the matching trace/request in Grafana without any extra plumbing here.
      logger.warn({ userId, chatRoomId }, 'Odrzucono próbę wysłania wiadomości bez dostępu do pokoju');
      throw new Error('FORBIDDEN');
    }

    const newMessage = await repository.createMessage(chatRoomId, userId, text);
    return mapToMessageDTO(newMessage);
  };

  const markUserOnline = (userId: string, socketId: string): Promise<void> => presenceStore.setUserOnline(userId, socketId);
  const markUserOffline = (userId: string): Promise<void> => presenceStore.setUserOffline(userId);

  return { getActiveChats, getChatHistory, joinChatRoom, sendMessage, markUserOnline, markUserOffline };
};
