import { create } from 'zustand';

interface ChatUiState {
  activeRoomId: string | null;
  draftText: string;
  setActiveRoomId: (roomId: string | null) => void;
  setDraftText: (text: string) => void;
  clearDraft: () => void;
}

// UI-only state — which room is open and what's typed but not yet sent. Message history and
// the live socket connection are `api/useChat.ts`'s job; this store never touches the network.
export const useChatStore = create<ChatUiState>((set) => ({
  activeRoomId: null,
  draftText: '',
  setActiveRoomId: (roomId) => set({ activeRoomId: roomId }),
  setDraftText: (text) => set({ draftText: text }),
  clearDraft: () => set({ draftText: '' }),
}));
