import { getUserRooms, getRoomMessages, createChatRoom, createMessage, findChatRoomByKey, findPetById } from "./chat.repository.js";
import { ChatListResponseDTO } from "./dto/chat-list-response.dto.js";
import { MessageResponseDTO } from "./dto/message-response.dto.js";
import { ChatRoomWithRelations, MessageWithSender } from "./interface/chat.interface.js";

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
 * Wykorzystywany zarówno w kontrolerze HTTP, jak i w bramie WebSocket (Gateway).
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

/**
 * Pobiera listę wszystkich aktywnych konwersacji powiązanych z danym użytkownikiem.
 */
export const getActiveChats = async (userId: string): Promise<ChatListResponseDTO[]> => {
  const rooms = await getUserRooms(userId);
  
  // Rzutujemy wynik z repozytorium na nasz bezpieczny interfejs relacyjny przed mapowaniem
  return (rooms as ChatRoomWithRelations[]).map(room => mapToChatListDTO(room, userId));
};

/**
 * Pobiera pełną historię wiadomości dla konkretnego pokoju czatu.
 */
export const getChatHistory = async (roomId: string): Promise<MessageResponseDTO[]> => {
  const messages = await getRoomMessages(roomId);
  
  // Rzutujemy i mapujemy na tablicę DTO wiadomości
  return (messages as MessageWithSender[]).map(mapToMessageDTO);
};


export const joinChatRoom = async (userId: string, petId: string, finderId: string) => {
  const pet = await findPetById(petId);
  if (!pet) throw new Error('PET_NOT_FOUND');
  
  if (userId !== pet.ownerId && userId !== finderId) {
    throw new Error('UNAUTHORIZED');
  }

  let chatRoom = await findChatRoomByKey(petId, pet.ownerId, finderId);
  if (!chatRoom) {
    chatRoom = await createChatRoom(petId, pet.ownerId, finderId);
  }

  const history = await getRoomMessages(chatRoom.id);
  
  return { 
    roomId: chatRoom.id, 
    history: history.map(mapToMessageDTO) 
  };
};

export const saveMessage = async (userId: string, roomId: string, text: string) => {
  const newMessage = await createMessage(roomId, userId, text);
  return mapToMessageDTO(newMessage);
};