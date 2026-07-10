export interface ChatListResponseDTO {
  roomId: string;
  pet: {
    id: string;
    // Opcjonalne: Znalazca może nie znać imienia zwierzaka (Kreator V2) — patrz Pet.name w
    // schema.prisma.
    name: string | null;
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