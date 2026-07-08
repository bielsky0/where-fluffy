import { JoinChatSchema, SendMessageSchema } from './chat.schema.js';
import { ChatService } from './chat.service.js';
import { ChatIoServer, ChatIoSocket } from './interface/chat.interface.js';
import { SocketEventRateLimiter } from '../../shared/rate-limit/rate-limiter.socket.js';

export const createChatGateway = (io: ChatIoServer, chatService: ChatService, rateLimitEvents: SocketEventRateLimiter): void => {
  io.on('connection', async (socket: ChatIoSocket) => {
    const userId = socket.data.userId;
    if (!userId) return socket.disconnect();

    // Rejestrujemy WSZYSTKIE listenery synchronicznie, zanim jakikolwiek await odda kontrolę do
    // event loopa. Wcześniej `await chatService.markUserOnline(...)` (rundtrip do Redis) szedł
    // pierwszy — klient, który emituje zdarzenie natychmiast po połączeniu (normalne zachowanie
    // szybkiego klienta, nie tylko testów obciążeniowych), potrafił wygrać ten wyścig: socket.io
    // dispatchował pakiet zanim `socket.on('join_chat', ...)` w ogóle istniał, a `EventEmitter`
    // bez zarejestrowanego listenera po prostu cicho gubi zdarzenie — bez błędu, bez loga.
    //
    // Limit częstotliwości zdarzeń (join_chat/send_message/...) per userId — patrz
    // shared/rate-limit/rate-limiter.socket.ts. socket.use() NIE rozłącza automatycznie przy
    // next(err) (inaczej niż io.use() w shared/infrastructure/socket.ts), więc obsługujemy to
    // jawnie przez zdarzenie 'error', zgodnie z oficjalnym wzorcem Socket.io.
    socket.use(rateLimitEvents(userId));
    socket.on('error', (error) => socket.emit('error_response', { message: error.message }));

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

    await chatService.markUserOnline(userId, socket.id);
    console.log(`[WS] Połączono: ${userId}`);
  });
};
