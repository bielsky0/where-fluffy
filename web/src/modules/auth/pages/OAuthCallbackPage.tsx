import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { readFreshIntent, usePendingIntentStore } from '../store/usePendingIntentStore';

const ERROR_COPY: Record<string, (provider: string) => string> = {
  oauth_disabled: (provider) => `Logowanie przez ${provider} jest chwilowo niedostępne. Spróbuj innej metody.`,
  oauth_failed: (provider) => `Nie udało się zalogować przez ${provider}. Spróbuj ponownie lub użyj adresu e-mail.`,
};

// The ONE place every OAuth redirect lands (see auth.oauth.controller.ts's
// handleGoogleCallback/handleFacebookCallback — both always redirect here, success or failure).
// A successful redirect has already set the session cookie server-side; this page's only job is
// to wait for SessionBootstrap's GET /auth/me to pick that up (via useAuthStore.isLoading), then
// navigate to wherever the pre-redirect action wanted to resume (see usePendingIntentStore,
// written by useProtectedAction before the redirect ever fired) — the actual "do the thing"
// (auto-publish, reopen a sheet) is executed by whatever mounts at that returnPath, not here.
export default function OAuthCallbackPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const errorCode = params.get('error');
  const provider = params.get('provider') ?? 'wybranego dostawcy';

  useEffect(() => {
    if (isLoading) return; // still resolving GET /auth/me after the redirect

    if (!currentUser) {
      // Failed/denied/disabled — nothing to resume; an abandoned attempt shouldn't linger and
      // incorrectly replay against a later, unrelated login.
      usePendingIntentStore.getState().clearIntent();
      return;
    }

    const intent = readFreshIntent();
    navigate(intent?.returnPath ?? '/app', { replace: true });
  }, [isLoading, currentUser, navigate]);

  if (!isLoading && !currentUser) {
    const message = (errorCode ? ERROR_COPY[errorCode] : undefined)?.(provider) ?? ERROR_COPY.oauth_failed(provider);
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <p className="text-sm text-neutral-600">{message}</p>
        <div className="flex flex-col gap-3">
          {params.get('provider') && (
            <button
              type="button"
              onClick={() => {
                window.location.href = `${API_BASE_URL}/auth/${params.get('provider')}`;
              }}
              className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white active:bg-rose-700"
            >
              Spróbuj ponownie
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              navigate('/app', { replace: true });
              openAuthModal();
            }}
            className="rounded-full border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 active:bg-neutral-50"
          >
            Zaloguj się e-mailem
          </button>
        </div>
      </div>
    );
  }

  return <div aria-hidden="true" className="h-dvh w-full animate-pulse bg-neutral-100" />;
}
