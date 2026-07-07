import { Server, Socket } from 'socket.io';
import { JoinChatSchema, SendMessageSchema } from './chat.schema.js';
import * as chatService from './chat.service.js';
import { grantUserAccess, checkUserAccess, setUserOffline, setUserOnline } from './chat.repository.js';

export const registerChatHandlers = (io: Server) => {
  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId as string;
    if (!userId) return socket.disconnect();

    await setUserOnline(userId, socket.id);
    console.log(`[WS] Połączono: ${userId}`);

    // --- EVENT: Dołączenie ---
    socket.on('join_chat', async (data) => {
      const parsed = JoinChatSchema.safeParse(data);
      if (!parsed.success) return socket.emit('error_response', { message: 'Błędne dane.' });

      try {
        const { petId, finderId } = parsed.data;
        // Serwis weryfikuje bazę SQL tylko raz przy dołączeniu
        const result = await chatService.joinChatRoom(userId, petId, finderId);
        
        // Zapisujemy dostęp w Redis (czas trwania: np. 1 godzina)
        await grantUserAccess(userId, result.roomId);
        
        socket.join(result.roomId);
        socket.emit('chat_joined', result);
      } catch (error) {
        socket.emit('error_response', { message: 'Brak uprawnień lub błąd.' });
      }
    });

    // --- EVENT: Wysłanie wiadomości ---
    socket.on('send_message', async (data) => {
      const parsed = SendMessageSchema.safeParse(data);
      if (!parsed.success) return socket.emit('error_response', { message: 'Błędny format.' });

      try {
        const { chatRoomId, text } = parsed.data;

        // ✅ KLUCZOWY MOMENT: Sprawdzamy dostęp w REDIS, nie w SQL!
        const hasAccess = await checkUserAccess(userId, chatRoomId);
        if (!hasAccess) {
          return socket.emit('error_response', { message: 'Brak dostępu do pokoju.' });
        }

        // Jeśli dostęp jest w Redis, zapisujemy wiadomość w bazie
        const messageDTO = await chatService.saveMessage(userId, chatRoomId, text);
        io.to(chatRoomId).emit('new_message', messageDTO);
      } catch (error) {
        socket.emit('error_response', { message: 'Błąd zapisu wiadomości.' });
      }
    });

    socket.on('disconnect', () => setUserOffline(userId));
  });
};