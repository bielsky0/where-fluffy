export interface MessageResponseDTO {
  id: string;
  chatRoomId: string;
  text: string;
  createdAt: string; // ISO String
  sender: {
    id: string;
    name: string;
  };
}