export interface ChatListResponseDTO {
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
    createdAt: string; // ISO String
  } | null;
}