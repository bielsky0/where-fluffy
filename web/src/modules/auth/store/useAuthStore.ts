import { create } from 'zustand';
import type { User } from '../types/auth.types';

interface AuthState {
  // Mirrors the result of GET /auth/me (see api/useAuth.ts's useMe / components/SessionBootstrap.tsx)
  // — this store never talks to the network itself and is never persisted (no localStorage/
  // sessionStorage), per the app's zero-persistence rule for session state. `currentUser`/
  // `isLoading` have exactly one writer: SessionBootstrap's effect, syncing whatever the /auth/me
  // query currently reports.
  currentUser: User | null;
  isLoading: boolean;
  // UI-only state for the deferred-auth flow: whether AuthBottomSheet is showing, and which
  // action (if any) should run automatically once login succeeds.
  isAuthModalOpen: boolean;
  pendingAction: (() => void) | null;

  setSession: (user: User | null, isLoading: boolean) => void;
  openAuthModal: (pendingAction?: () => void) => void;
  closeAuthModal: () => void;
  consumePendingAction: () => (() => void) | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isLoading: true,
  isAuthModalOpen: false,
  pendingAction: null,

  setSession: (user, isLoading) => set({ currentUser: user, isLoading }),

  openAuthModal: (pendingAction) => set({ isAuthModalOpen: true, pendingAction: pendingAction ?? null }),

  closeAuthModal: () => set({ isAuthModalOpen: false }),

  consumePendingAction: () => {
    const action = get().pendingAction;
    set({ pendingAction: null });
    return action;
  },
}));
