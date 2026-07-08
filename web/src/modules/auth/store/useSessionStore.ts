import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/auth.types';

interface SessionState {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

// Tracks "who's logged in" purely client-side, seeded by useLogin/useLogout's mutation
// results (api/useAuth.ts) — there is no GET /auth/me session-check endpoint on the backend
// (auth.routes.ts only exposes /register, /login, /logout), so this is a heuristic, not a
// verified truth. The httpOnly `token` cookie is the real source of truth server-side and can
// expire (24h — see auth.controller.ts's cookie maxAge) while this persisted value still says
// "logged in". A stale value here doesn't grant any real access: every real endpoint is still
// enforced by auth.middleware.ts, so the worst case is a 401 on the next authenticated request,
// prompting a re-login — not a security hole.
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),
    }),
    { name: 'fluffy-session' },
  ),
);
