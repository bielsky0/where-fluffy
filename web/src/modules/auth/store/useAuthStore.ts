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
  // UI-only state for the deferred-auth flow: whether AuthBottomSheet is showing, which action
  // (if any) should run automatically once login succeeds in-page, and which identifier (if any)
  // to pre-fill so the sheet can skip straight to the OTP stage (e.g. the wizard already knows
  // the guest's e-mail from its own form). `pendingAction` is a closure and only survives an
  // in-page flow (OTP/password) — anything that must also survive a real OAuth redirect goes
  // through usePendingIntentStore's persisted, serializable intent instead.
  isAuthModalOpen: boolean;
  pendingAction: (() => void) | null;
  prefillIdentifier: string | null;

  setSession: (user: User | null, isLoading: boolean) => void;
  openAuthModal: (pendingAction?: () => void, prefillIdentifier?: string) => void;
  closeAuthModal: () => void;
  consumePendingAction: () => (() => void) | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isLoading: true,
  isAuthModalOpen: false,
  pendingAction: null,
  prefillIdentifier: null,

  setSession: (user, isLoading) => set({ currentUser: user, isLoading }),

  openAuthModal: (pendingAction, prefillIdentifier) =>
    set({ isAuthModalOpen: true, pendingAction: pendingAction ?? null, prefillIdentifier: prefillIdentifier ?? null }),

  closeAuthModal: () => set({ isAuthModalOpen: false, prefillIdentifier: null }),

  consumePendingAction: () => {
    const action = get().pendingAction;
    set({ pendingAction: null });
    return action;
  },
}));
