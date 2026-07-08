// Mirrors src/modules/chat/dto/*.dto.ts and the Socket.io event contracts in
// src/modules/chat/interface/chat.interface.ts. Duplicated here for the same reason as
// pets.types.ts — shared-types/ is still an empty placeholder; once populated, both sides
// should import these from there instead.
export interface ChatMessage {
  id: string;
  chatRoomId: string;
  text: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
  };
}

export interface ChatRoomSummary {
  roomId: string;
  pet: {
    id: string;
    name: string;
    status: string;
  };
  interlocutor: {
    id: string;
    name: string;
  };
  lastMessage: {
    text: string;
    senderName: string;
    createdAt: string;
  } | null;
}

export interface JoinChatPayload {
  petId: string;
  finderId: string;
}

export interface SendMessagePayload {
  chatRoomId: string;
  text: string;
}

export type ClientToServerEvents = {
  join_chat: (data: JoinChatPayload) => void;
  send_message: (data: SendMessagePayload) => void;
};

export type ServerToClientEvents = {
  chat_joined: (payload: { roomId: string; history: ChatMessage[] }) => void;
  new_message: (payload: ChatMessage) => void;
  error_response: (payload: { message: string }) => void;
};
