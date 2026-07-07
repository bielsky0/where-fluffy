import { createChatGateway } from './modules/chat/chat.gateway.js';
import { chatService } from './modules/chat/index.js';
import type { ChatIoServer } from './modules/chat/interface/chat.interface.js';
// import { registerNotificationHandlers } from './modules/notifications/notifications.gateway'; <-- tu dojdą kolejne

/**
 * Główny rejestr dla wszystkich modułów czasu rzeczywistego.
 * Jeśli dodasz nowy moduł z WebSocketami, dopisujesz go TYLKO tutaj.
 */
export const registerAllGateways = (io: ChatIoServer): void => {
  createChatGateway(io, chatService);

  // registerNotificationHandlers(io); // Przyszłe moduły wpinasz jedną linijką
};