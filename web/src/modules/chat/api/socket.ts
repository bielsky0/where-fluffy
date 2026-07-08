import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/chat.types';

// Chat is the only module using WebSockets today (mirrors the backend note in
// src/modules/chat/interface/chat.interface.ts) — if a second WS module shows up, this should
// move to lib/ as a shared connection, same call the backend already flagged for its own
// socket types.
let chatSocket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

// Cookie-based auth (see CLAUDE.md "Auth") — same httpOnly `token` cookie the WS handshake in
// shared/infrastructure/socket.ts reads server-side, so no token needs passing here explicitly
// as long as `withCredentials` is set.
export function getChatSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!chatSocket) {
    chatSocket = io('/', {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
    });
  }
  return chatSocket;
}
