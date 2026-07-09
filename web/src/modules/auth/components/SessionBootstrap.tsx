import { useEffect } from 'react';
import { useMe } from '../api/useAuth';
import { useAuthStore } from '../store/useAuthStore';

// Mounted once, eagerly, at the true root (see App.tsx) — the one place that actually calls
// useMe() and is the sole writer of useAuthStore's currentUser/isLoading (via setSession). Every
// other component reads the store instead of calling useMe() itself, per the "one centralized
// AuthStore" requirement. Renders nothing; it's a wiring component, not UI.
export function SessionBootstrap() {
  const { data, isPending, isError } = useMe();
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    setSession(isError ? null : (data?.user ?? null), isPending);
  }, [data, isPending, isError, setSession]);

  return null;
}
