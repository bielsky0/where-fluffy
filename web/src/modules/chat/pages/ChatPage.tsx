import { useMemo } from 'react';
import { useChatHistory, useChatRoomConnection, useChatRooms } from '../api/useChat';
import { useChatStore } from '../store/useChatStore';
import { ChatMessageBubble } from '../components/ChatMessageBubble';

export default function ChatPage() {
  const { data: rooms, isLoading: roomsLoading } = useChatRooms();

  const activeRoomId = useChatStore((state) => state.activeRoomId);
  const setActiveRoomId = useChatStore((state) => state.setActiveRoomId);
  const draftText = useChatStore((state) => state.draftText);
  const setDraftText = useChatStore((state) => state.setDraftText);
  const clearDraft = useChatStore((state) => state.clearDraft);

  const activeRoom = useMemo(
    () => rooms?.find((room) => room.roomId === activeRoomId),
    [rooms, activeRoomId],
  );

  // Only join the live socket room once a room has actually been selected — `joinPayload`
  // being undefined skips the join effect entirely (see useChatRoomConnection).
  const { sendMessage } = useChatRoomConnection(
    activeRoom
      ? { petId: activeRoom.pet.id, finderId: activeRoom.interlocutor.id }
      : undefined,
  );

  const { data: messages, isLoading: historyLoading } = useChatHistory(activeRoomId ?? undefined);

  const handleSend = () => {
    if (!activeRoomId || !draftText.trim()) return;
    sendMessage(activeRoomId, draftText.trim());
    clearDraft();
  };

  return (
    <section>
      <aside>
        <h2>Chats</h2>
        {roomsLoading && <p>Loading chats…</p>}
        <ul>
          {rooms?.map((room) => (
            <li key={room.roomId}>
              <button type="button" onClick={() => setActiveRoomId(room.roomId)}>
                {room.pet.name ?? 'Zwierzak'} — {room.interlocutor.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main>
        {!activeRoomId && <p>Select a chat to start messaging.</p>}
        {activeRoomId && historyLoading && <p>Loading messages…</p>}
        {activeRoomId && messages && (
          <>
            <div>
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} isOwnMessage={false} />
              ))}
            </div>
            <div>
              <input
                type="text"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSend()}
                placeholder="Type a message…"
              />
              <button type="button" onClick={handleSend}>
                Send
              </button>
            </div>
          </>
        )}
      </main>
    </section>
  );
}
