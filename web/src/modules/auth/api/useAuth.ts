import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { LoginPayload, LoginResponse, RegisterPayload, User } from '../types/auth.types';

// POST /auth/login (src/modules/auth/auth.routes.ts) — the JWT itself comes back as an
// httpOnly `token` cookie (see CLAUDE.md "Auth"), never in the response body, so there's
// nothing to persist client-side beyond the `user` object.
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<User>(['auth', 'me'], user);
    },
  });
}

// POST /auth/register
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
    onSuccess: () => queryClient.setQueryData(['auth', 'me'], null),
  });
}
