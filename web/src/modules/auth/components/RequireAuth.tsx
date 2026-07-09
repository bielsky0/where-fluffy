import { useEffect, useRef, type ReactNode } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface RequireAuthProps {
  children: ReactNode;
}

// Navigation Guard (spec #4A), for the few real router-addressable routes that assume a session
// (currently just /app/chat — see routes.tsx). Deliberately never redirects to /login: the user
// stays on the route (or a skeleton of it) while AuthBottomSheet opens on top, same UX as the
// Action Guard (useProtectedAction), just triggered by landing on a URL instead of a click.
export function RequireAuth({ children }: RequireAuthProps) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  // Guards against re-opening the sheet on every render once it's already been requested for
  // this mount — openAuthModal itself is idempotent-ish (just sets state) but there's no reason
  // to keep calling it.
  const hasRequestedAuth = useRef(false);

  useEffect(() => {
    if (isLoading || currentUser || hasRequestedAuth.current) return;
    hasRequestedAuth.current = true;
    openAuthModal();
  }, [isLoading, currentUser, openAuthModal]);

  if (isLoading) return null;

  // No session: render a skeleton instead of `children` so the guarded page's own data hooks
  // (e.g. ChatPage's useChatRooms/useChatRoomConnection) never mount without one, while
  // AuthBottomSheet floats on top per the effect above.
  if (!currentUser) {
    return <div aria-hidden="true" className="h-dvh w-full animate-pulse bg-neutral-100" />;
  }

  return <>{children}</>;
}
