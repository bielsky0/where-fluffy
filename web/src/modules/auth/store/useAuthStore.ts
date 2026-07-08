import { create } from 'zustand';

// Deliberately opaque — this store only knows "something was attempted", not what. It has an
// `id` the caller defines and re-interprets after login (see AppShell.tsx's `ActionId`), which
// keeps modules/auth from needing to know anything about pets/map/sighting concepts.
export interface AttemptedAction {
  id: string;
}

interface AuthUiState {
  isAuthModalOpen: boolean;
  attemptedAction: AttemptedAction | null;
  requestAuth: (action: AttemptedAction) => void;
  closeAuthModal: () => void;
  consumeAttemptedAction: () => AttemptedAction | null;
}

// UI-only state for the deferred-auth flow: whether AuthModal is showing, and which gated
// action (if any) triggered it, so the caller can resume that exact action once login
// succeeds. Never touches the network or holds the actual user — that's useSessionStore's job.
export const useAuthStore = create<AuthUiState>((set, get) => ({
  isAuthModalOpen: false,
  attemptedAction: null,
  requestAuth: (action) => set({ isAuthModalOpen: true, attemptedAction: action }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  consumeAttemptedAction: () => {
    const action = get().attemptedAction;
    set({ attemptedAction: null });
    return action;
  },
}));
