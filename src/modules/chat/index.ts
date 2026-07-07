import { prisma } from '../../shared/prisma.js';
import { redisClient } from '../../shared/infrastructure/redis.js';
import { createChatRepository } from './chat.repository.js';
import { createChatPresenceStore } from './chat.presence.js';
import { createChatService } from './chat.service.js';
import { createChatController } from './chat.controller.js';

// Uwaga: createChatGateway(io, chatService) NIE jest tu tworzony — instancja Socket.io
// (`io`) powstaje dopiero w main.ts/shared/infrastructure/socket.ts, już po tym jak ten plik
// zostanie zaimportowany. Bramkę składamy więc w app.gateways.ts, w miejscu gdzie `io` faktycznie
// istnieje, importując stąd gotowy `chatService`.
export const chatRepository = createChatRepository(prisma);
export const chatPresenceStore = createChatPresenceStore(redisClient);
export const chatService = createChatService(chatRepository, chatPresenceStore);
export const chatController = createChatController(chatService);
