import { useAuthStore } from '../store/useAuthStore';

// Action Guard (spec #4B): wraps any interaction that requires a session. Runs `action`
// immediately if one already exists; otherwise stashes it as the store's pendingAction and
// opens AuthBottomSheet, which resumes `action` itself once login/register succeeds (see
// components/AuthBottomSheet.tsx) — the caller never wires up its own "on authenticated" callback.
export function useProtectedAction() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  return (action: () => void) => {
    if (currentUser) {
      action();
      return;
    }
    openAuthModal(action);
  };
}
