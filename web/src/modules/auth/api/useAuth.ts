import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useSessionStore } from '../store/useSessionStore';
import type { LoginPayload, LoginResponse, RegisterPayload, User } from '../types/auth.types';

// POST /auth/login (src/modules/auth/auth.routes.ts) — the JWT itself comes back as an
// httpOnly `token` cookie (see CLAUDE.md "Auth"), never in the response body. The `user`
// object is stored in useSessionStore, not the TanStack Query cache — there's no endpoint to
// ever re-fetch it from, so it isn't "server state" in the way TanStack Query models things;
// see useSessionStore.ts for what that heuristic actually means.
export function useLogin() {
  const setCurrentUser = useSessionStore((state) => state.setCurrentUser);

  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ user }) => setCurrentUser(user),
  });
}

// POST /auth/register — does not log the user in (no cookie is set), so registering alone
// doesn't populate the session store; see AuthBottomSheet.tsx, which chains a login call after a
// successful register to actually establish a session.
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
  const setCurrentUser = useSessionStore((state) => state.setCurrentUser);

  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => setCurrentUser(null),
  });
}
