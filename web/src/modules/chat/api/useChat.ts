import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { getChatSocket } from './socket';
import type { ChatMessage, ChatRoomSummary, JoinChatPayload } from '../types/chat.types';

// GET /chats (src/app.routes.ts mounts chat.routes.ts at '/chats', plural — not '/chat') —
// rooms the current user (owner or finder) is in.
export function useChatRooms() {
  return useQuery({
    queryKey: ['chat', 'rooms'],
    queryFn: () => apiFetch<ChatRoomSummary[]>('/chats'),
  });
}

// GET /chats/:roomId/messages — history for a room, seeded once; live updates after that come
// from the `new_message` socket event, not repeated fetches.
export function useChatHistory(roomId: string | undefined) {
  return useQuery({
    queryKey: ['chat', 'messages', roomId],
    queryFn: () => apiFetch<ChatMessage[]>(`/chats/${roomId}/messages`),
    enabled: Boolean(roomId),
  });
}

// Joins `roomId`'s live room over the existing chat socket (see chat.gateway.ts's
// `join_chat`/`send_message`/`new_message` contract) and mirrors incoming messages straight
// into the `useChatHistory` query cache, so the message list and the socket stay in sync
// without a manual local message array in component state.
export function useChatRoomConnection(joinPayload: JoinChatPayload | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!joinPayload) return;

    const socket = getChatSocket();
    if (!socket.connected) socket.connect();

    let roomId: string | undefined;

    const handleJoined = (payload: { roomId: string; history: ChatMessage[] }) => {
      roomId = payload.roomId;
      queryClient.setQueryData(['chat', 'messages', roomId], payload.history);
    };

    const handleNewMessage = (message: ChatMessage) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', message.chatRoomId], (prev) =>
        prev ? [...prev, message] : [message],
      );
    };

    socket.on('chat_joined', handleJoined);
    socket.on('new_message', handleNewMessage);
    socket.emit('join_chat', joinPayload);

    return () => {
      socket.off('chat_joined', handleJoined);
      socket.off('new_message', handleNewMessage);
    };
  }, [joinPayload, queryClient]);

  return {
    sendMessage: (chatRoomId: string, text: string) => {
      getChatSocket().emit('send_message', { chatRoomId, text });
    },
  };
}
