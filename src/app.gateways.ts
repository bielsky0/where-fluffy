import { createChatGateway } from './modules/chat/chat.gateway.js';
import { chatService } from './modules/chat/index.js';
import type { ChatIoServer } from './modules/chat/interface/chat.interface.js';
import { createSocketEventRateLimiter } from './shared/rate-limit/rate-limiter.socket.js';
import { redisClient } from './shared/infrastructure/redis.js';
// import { registerNotificationHandlers } from './modules/notifications/notifications.gateway'; <-- tu dojdą kolejne

// Współdzielony między wszystkimi bramkami — jeśli przyszły drugi moduł WS też potrzebuje
// throttlingu zdarzeń, może reużyć tę samą fabrykę z własnymi opcjami (własny keyPrefix).
const chatEventRateLimiter = createSocketEventRateLimiter(redisClient, {
  keyPrefix: 'rl:ws:chat-events',
  points: 20,
  duration: 10,
});

/**
 * Główny rejestr dla wszystkich modułów czasu rzeczywistego.
 * Jeśli dodasz nowy moduł z WebSocketami, dopisujesz go TYLKO tutaj.
 */
export const registerAllGateways = (io: ChatIoServer): void => {
  createChatGateway(io, chatService, chatEventRateLimiter);

  // registerNotificationHandlers(io); // Przyszłe moduły wpinasz jedną linijką
};