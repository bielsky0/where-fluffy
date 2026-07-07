import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { JoinChatSchema, SendMessageSchema } from '../chat.schema.js';
import { MessageResponseDTO } from '../dto/message-response.dto.js';

export interface IChatRoom {
  id: string;
  petId: string;
  ownerId: string;
  finderId: string;
  createdAt: Date;
}

export interface IMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

// Interfejsy pomocnicze odzwierciedlające strukturę danych zwracaną przez repozytorium (Prisma Joins)
export interface ChatRoomWithRelations {
  id: string;
  ownerId: string;
  finderId: string;
  createdAt: Date;
  pet: {
    id: string;
    name: string;
    status: string;
  };
  owner: {
    id: string;
    name: string;
  };
  finder: {
    id: string;
    name: string;
  };
  messages: Array<{
    text: string;
    createdAt: Date;
    sender: {
      name: string;
    };
  }>;
}

export interface MessageWithSender {
  id: string;
  chatRoomId: string;
  text: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
  };
}

// Minimalny kształt Pet potrzebny chat.service.ts do weryfikacji "owner albo finder" przy dołączeniu
export type ChatPetLookup = {
  id: string;
  ownerId: string;
};

// Funkcyjny kontrakt repozytorium (baza danych, przez Prisma)
export type ChatRepository = {
  getUserRooms: (userId: string) => Promise<ChatRoomWithRelations[]>;
  getRoomMessages: (roomId: string) => Promise<MessageWithSender[]>;
  findPetById: (id: string) => Promise<ChatPetLookup | null>;
  findChatRoomByKey: (petId: string, ownerId: string, finderId: string) => Promise<IChatRoom | null>;
  createChatRoom: (petId: string, ownerId: string, finderId: string) => Promise<IChatRoom>;
  createMessage: (chatRoomId: string, senderId: string, text: string) => Promise<MessageWithSender>;
};

// Funkcyjny kontrakt magazynu obecności/dostępu — osobny od ChatRepository, bo backend to Redis,
// nie Prisma (patrz CLAUDE.md "Chat access control (Redis as the trust boundary)").
export type ChatPresenceStore = {
  setUserOnline: (userId: string, socketId: string) => Promise<void>;
  setUserOffline: (userId: string) => Promise<void>;
  grantUserAccess: (userId: string, roomId: string) => Promise<void>;
  checkUserAccess: (userId: string, roomId: string) => Promise<boolean>;
};

// --- Typy zdarzeń Socket.io ---
// Kształty payloadów wynikają z tych samych schematów zod, którymi gateway waliduje dane
// w runtime — to wyłącznie dokumentacja kontraktu na poziomie typów; sama walidacja
// (safeParse) w chat.gateway.ts nadal jest wymagana, bo klient może wysłać cokolwiek.
export type JoinChatPayload = z.infer<typeof JoinChatSchema>;
export type SendMessagePayload = z.infer<typeof SendMessageSchema>;

export type ClientToServerEvents = {
  join_chat: (data: JoinChatPayload) => void;
  send_message: (data: SendMessagePayload) => void;
};

export type ServerToClientEvents = {
  chat_joined: (payload: { roomId: string; history: MessageResponseDTO[] }) => void;
  new_message: (payload: MessageResponseDTO) => void;
  error_response: (payload: { message: string }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketUser = {
  id: string;
  email?: string;
  name?: string;
};

export type SocketData = {
  user: SocketUser;
  userId: string;
};

// Skomponowane aliasy Server/Socket używane zarówno przez chat.gateway.ts, jak i przez
// shared/infrastructure/socket.ts oraz app.gateways.ts — jedno miejsce prawdy dla kształtu
// zdarzeń WS. Jeśli w przyszłości dojdzie drugi moduł z WebSocketami, te typy (i ClientToServerEvents/
// ServerToClientEvents/SocketData powyżej) powinny się przenieść w bardziej neutralne miejsce
// (np. shared/) i połączyć jako unia zdarzeń z obu modułów.
export type ChatIoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type ChatIoSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
