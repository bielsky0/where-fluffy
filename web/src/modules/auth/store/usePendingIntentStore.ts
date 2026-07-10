import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Serializable resume intents — deliberately NOT closures. A closure-based `pendingAction` (see
// useAuthStore) only survives an in-page auth flow (OTP/password), never a real OAuth redirect
// to accounts.google.com/facebook.com and back, which reloads the page and wipes all in-memory
// JS state. Anything that needs to resume after that redirect has to describe itself as plain
// data instead.
export type PendingIntent =
  | { kind: 'wizard-publish'; returnPath: '/app'; createdAt: number }
  | { kind: 'report-sighting'; petId: string; returnPath: string; createdAt: number }
  | { kind: 'app-navigate'; returnPath: string; createdAt: number };

// A plain `Omit<PendingIntent, 'createdAt'>` silently drops variant-specific fields like
// `petId` — `keyof` over a union only sees keys common to every member, so `Omit` (built on
// `Pick<T, Exclude<keyof T, K>>`) ends up picking only `kind`/`returnPath` for ALL variants. This
// distributes Omit across each member individually first, so 'report-sighting' correctly keeps
// requiring `petId`. Exported so callers building an intent (e.g. useProtectedAction's
// `resumeIntent` option) use the same correctly-distributed shape rather than re-deriving it.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type PendingIntentInput = DistributiveOmit<PendingIntent, 'createdAt'>;

interface PendingIntentState {
  intent: PendingIntent | null;
  setIntent: (intent: PendingIntentInput) => void;
  clearIntent: () => void;
}

// An abandoned OAuth tab (user closes it, comes back a day later, tries again) shouldn't replay
// a long-stale intent against an unrelated later login.
const MAX_AGE_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'where-fluffy:pending-auth-intent-v1';

export const usePendingIntentStore = create<PendingIntentState>()(
  persist(
    (set) => ({
      intent: null,
      setIntent: (intent) => set({ intent: { ...intent, createdAt: Date.now() } as PendingIntent }),
      clearIntent: () => set({ intent: null }),
    }),
    { name: STORAGE_KEY, storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

// Consumers should always go through this, not raw `usePendingIntentStore.getState().intent` —
// see MAX_AGE_MS above. Also clears the stale intent as a side effect so a later fresh intent
// isn't accidentally merged with leftover state.
export function readFreshIntent(): PendingIntent | null {
  const { intent, clearIntent } = usePendingIntentStore.getState();
  if (!intent) return null;
  if (Date.now() - intent.createdAt > MAX_AGE_MS) {
    clearIntent();
    return null;
  }
  return intent;
}
