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