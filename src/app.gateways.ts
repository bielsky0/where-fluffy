import { Server } from 'socket.io';
import { registerChatHandlers } from './modules/chat/chat.gateway.js';
// import { registerNotificationHandlers } from './modules/notifications/notifications.gateway'; <-- tu dojdą kolejne

/**
 * Główny rejestr dla wszystkich modułów czasu rzeczywistego.
 * Jeśli dodasz nowy moduł z WebSocketami, dopisujesz go TYLKO tutaj.
 */
export const registerAllGateways = (io: Server): void => {
  registerChatHandlers(io);
  
  // registerNotificationHandlers(io); // Przyszłe moduły wpinasz jedną linijką
};