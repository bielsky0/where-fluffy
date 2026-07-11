// Exported so callers that need to leave the SPA entirely (a real browser navigation, not a
// fetch) can build a URL against the same base — e.g. AuthBottomSheet.tsx's OAuth buttons,
// which do `window.location.href = `${API_BASE_URL}/auth/google`` to start a server redirect.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    // Machine-readable error code (see src/shared/errors/app-error.ts's optional `code`) — e.g.
    // OTP_CODE_INVALID/OTP_CODE_EXPIRED, so callers can branch without matching Polish copy.
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}

// `credentials: 'include'` is required on every call — auth is an httpOnly `token` cookie
// (see CLAUDE.md "Auth"), not a bearer header, so fetch won't send it unless asked to.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.message ?? `Request to ${path} failed`, body?.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
