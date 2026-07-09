import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { LoginPayload, LoginResponse, RegisterPayload, User } from '../types/auth.types';

// Shared cache key for the session-verification query below — also used by useLogin/useLogout
// to write straight into the same cache entry, and by AppProviders.tsx to exclude this query
// from the offline-mutation persister (see that file's comment on why persisting it would
// silently defeat the "always re-verify on reload" guarantee).
export const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

// GET /auth/me (src/modules/auth/auth.routes.ts) — relies solely on the httpOnly `token` cookie
// (see CLAUDE.md "Auth"), no token ever touches the front-end. `staleTime: Infinity` means this
// only ever runs once per app load (see components/SessionBootstrap.tsx, which is what actually
// mounts this): a 401 here just means "guest", not a transient failure, so it isn't retried.
export function useMe() {
  return useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => apiFetch<LoginResponse>('/auth/me'),
    staleTime: Infinity,
    retry: false,
  });
}

// POST /auth/login (src/modules/auth/auth.routes.ts) — the JWT itself comes back as an
// httpOnly `token` cookie (see CLAUDE.md "Auth"), never in the response body. Writes the
// resulting user straight into the /auth/me query cache rather than a separate store setter —
// useAuthStore's currentUser has exactly one writer (SessionBootstrap, mirroring this same
// query), so this is the one path that changes it.
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => queryClient.setQueryData(AUTH_ME_QUERY_KEY, data),
  });
}

// POST /auth/register — does not log the user in (no cookie is set), so registering alone
// doesn't populate the session; see AuthBottomSheet.tsx, which chains a login call after a
// successful register to actually establish one.
export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      apiFetch<User>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

// POST /auth/logout — clears the cookie server-side; nothing meaningful in the response body.
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.setQueryData(AUTH_ME_QUERY_KEY, null),
  });
}
