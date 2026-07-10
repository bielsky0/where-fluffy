import { useAuthStore } from '../store/useAuthStore';
import { usePendingIntentStore, type PendingIntentInput } from '../store/usePendingIntentStore';

export type ProtectedActionOptions = {
  // Skips AuthBottomSheet straight to the OTP stage pre-filled with this address, when the
  // caller already knows it (e.g. the wizard's own contact-details step).
  prefillIdentifier?: string;
  // Serializable description of `action`, persisted so it survives a full-page OAuth redirect
  // (see usePendingIntentStore) — `action` itself is a closure and would be lost on reload.
  // Callers whose action only matters for the in-page OTP/password path (no reload) can omit
  // this; it's required for anything that should also resume after Google/Facebook OAuth.
  resumeIntent?: PendingIntentInput;
};

// Action Guard (spec #4B): wraps any interaction that requires a session. Runs `action`
// immediately if one already exists; otherwise stashes it as the store's pendingAction and
// opens AuthBottomSheet, which resumes `action` itself once login/register/OTP succeeds
// in-page (see components/AuthBottomSheet.tsx) — the caller never wires up its own
// "on authenticated" callback. If `resumeIntent` is given, it's also persisted so the same
// intent can be replayed by a resume-on-landing effect after a real OAuth redirect, which
// reloads the page and drops `pendingAction` entirely.
export function useProtectedAction() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const setIntent = usePendingIntentStore((state) => state.setIntent);

  return (action: () => void, options?: ProtectedActionOptions) => {
    if (currentUser) {
      action();
      return;
    }
    if (options?.resumeIntent) setIntent(options.resumeIntent);
    openAuthModal(action, options?.prefillIdentifier);
  };
}
