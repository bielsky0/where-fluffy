import { Server, Socket } from 'socket.io';
import { findPetById, findChatRoomByKey, createChatRoom, findChatRoomById, createMessage } from './chat.repository.js';
import { getChatHistory, mapToMessageDTO } from './chat.service.js';
import { MessageWithSender } from './interface/chat.interface.js';


interface JoinChatPayload {
  petId: string;
  finderId: string;
}

interface SendMessagePayload {
  chatRoomId: string;
  text: string;
}

export const registerChatHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    console.log(`[WS] Połączono klienta: ${userId}`);

    // --- EVENT: Dołączenie do pokoju czatu ---
    socket.on('join_chat', async (payload: JoinChatPayload) => {
      const { petId, finderId } = payload;

      if (!petId || !finderId) {
        return socket.emit('error_response', { message: 'Brakujące parametry petId lub finderId.' });
      }

      try {
        // Używamy REPOZYTORIUM zamiast bezpośredniej Prismy
        const pet = await findPetById(petId);
        if (!pet) {
          return socket.emit('error_response', { message: 'Ogłoszenie zwierzaka nie istnieje.' });
        }

        const ownerId = pet.ownerId;

        if (userId !== ownerId && userId !== finderId) {
          return socket.emit('error_response', { message: 'Brak uprawnień do tego pokoju czatu.' });
        }

        // Szukamy pokoju przez REPOZYTORIUM
        let chatRoom = await findChatRoomByKey(petId, ownerId, finderId);

        if (!chatRoom) {
          chatRoom = await createChatRoom(petId, ownerId, finderId);
        }

        socket.join(chatRoom.id);
        
        // Wykorzystujemy gotowy SERWIS, który od razu mapuje historię na MessageResponseDTO[]
        const historyDTO = await getChatHistory(chatRoom.id);
        
        socket.emit('chat_joined', { 
          chatRoomId: chatRoom.id, 
          history: historyDTO 
        });

      } catch (error) {
        console.error('[WS ERROR] Błąd w join_chat:', error);
        socket.emit('error_response', { message: 'Nie udało się dołączyć do czatu.' });
      }
    });

    // --- EVENT: Wysłanie nowej wiadomości ---
    socket.on('send_message', async (payload: SendMessagePayload) => {
      const { chatRoomId, text } = payload;

      if (!chatRoomId || !text || text.trim() === '') {
        return socket.emit('error_response', { message: 'Wiadomość nie może być pusta.' });
      }

      try {
        // Sprawdzenie pokoju przez REPOZYTORIUM
        const room = await findChatRoomById(chatRoomId);
        if (!room) {
          return socket.emit('error_response', { message: 'Pokój czatu nie istnieje.' });
        }

        if (room.ownerId !== userId && room.finderId !== userId) {
          return socket.emit('error_response', { message: 'Brak uprawnień do pisania w tym pokoju.' });
        }

        // Zapis wiadomości przez REPOZYTORIUM
        const newMessage = await createMessage(chatRoomId, userId, text.trim());

        // Mapowanie na DTO za pomocą mappera z serwisu
        const messageDTO = mapToMessageDTO(newMessage as MessageWithSender);

        // Rozgłoszenie wiadomości
        io.to(chatRoomId).emit('new_message', messageDTO);

      } catch (error) {
        console.error('[WS ERROR] Błąd w send_message:', error);
        socket.emit('error_response', { message: 'Wiadomość nie została dostarczona.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Rozłączono klienta: ${userId}`);
    });
  });
};