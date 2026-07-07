import { JoinChatSchema, SendMessageSchema } from './chat.schema.js';
import { ChatService } from './chat.service.js';
import { ChatIoServer, ChatIoSocket } from './interface/chat.interface.js';

export const createChatGateway = (io: ChatIoServer, chatService: ChatService): void => {
  io.on('connection', async (socket: ChatIoSocket) => {
    const userId = socket.data.userId;
    if (!userId) return socket.disconnect();

    await chatService.markUserOnline(userId, socket.id);
    console.log(`[WS] Połączono: ${userId}`);

    // --- EVENT: Dołączenie ---
    socket.on('join_chat', async (data) => {
      // "data" jest typowane jako JoinChatPayload dzięki ClientToServerEvents, ale to tylko
      // deklaracja intencji — klient nie jest niczym związany, więc walidacja w runtime zostaje.
      const parsed = JoinChatSchema.safeParse(data);
      if (!parsed.success) return socket.emit('error_response', { message: 'Błędne dane.' });

      try {
        const { petId, finderId } = parsed.data;
        // Serwis weryfikuje bazę SQL tylko raz przy dołączeniu i sam zapisuje dostęp w Redis
        const result = await chatService.joinChatRoom(userId, petId, finderId);

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

        // Sprawdzenie dostępu (Redis) i zapis wiadomości (SQL) dzieją się teraz w serwisie —
        // gateway tylko przekazuje dane i emituje wynik przez Socket.io.
        const messageDTO = await chatService.sendMessage(userId, chatRoomId, text);
        io.to(chatRoomId).emit('new_message', messageDTO);
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'FORBIDDEN'
            ? 'Brak dostępu do pokoju.'
            : 'Błąd zapisu wiadomości.';
        socket.emit('error_response', { message });
      }
    });

    socket.on('disconnect', () => chatService.markUserOffline(userId));
  });
};
