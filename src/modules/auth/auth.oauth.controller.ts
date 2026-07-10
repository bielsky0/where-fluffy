import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { OAuthProvider, OAuthStateStore, OAuthVerifier } from './interface/auth.interface.js';
import { setAuthCookie } from './auth.cookie.js';

export type OAuthController = {
  redirectToGoogle: (req: Request, res: Response) => Promise<void>;
  handleGoogleCallback: (req: Request, res: Response) => Promise<void>;
  redirectToFacebook: (req: Request, res: Response) => Promise<void>;
  handleFacebookCallback: (req: Request, res: Response) => Promise<void>;
};

// providerEnabled: kill switch (patrz shared/config/oauth.config.ts) — gdy dostawca jest
// wyłączony w konfiguracji, /auth/<provider> w ogóle nie rozpoczyna przepływu OAuth, tylko od
// razu odsyła z powrotem na frontend z ?error=oauth_disabled.
export const createOAuthController = (
  authService: AuthService,
  googleVerifier: OAuthVerifier,
  facebookVerifier: OAuthVerifier,
  stateStore: OAuthStateStore,
  frontendUrl: string,
  providerEnabled: { google: boolean; facebook: boolean },
): OAuthController => {
  const redirectToProvider =
    (provider: OAuthProvider, verifier: OAuthVerifier) =>
    async (_req: Request, res: Response): Promise<void> => {
      if (!providerEnabled[provider]) {
        res.redirect(`${frontendUrl}/auth/callback?error=oauth_disabled&provider=${provider}`);
        return;
      }
      const state = await stateStore.create();
      res.redirect(verifier.getAuthorizationUrl(state));
    };

  const handleCallback =
    (provider: OAuthProvider, verifier: OAuthVerifier) =>
    async (req: Request, res: Response): Promise<void> => {
      const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
      try {
        if (error || !code || !state || !(await stateStore.consume(state))) {
          throw new Error('invalid_oauth_callback');
        }
        const profile = await verifier.exchangeCodeForProfile(code);
        const { token } = await authService.loginWithOAuth(provider, profile);
        setAuthCookie(res, token);
        res.redirect(`${frontendUrl}/auth/callback`);
      } catch {
        // Użytkownik jest w trakcie przekierowania z Google/Facebooka, nie wywołuje tego jako
        // klient API — zwrócenie surowego JSON-a 4xx/5xx byłoby bezużyteczne; zamiast tego
        // odsyłamy z powrotem na frontend z flagą błędu, tam obsłużoną jako czytelny ekran
        // (patrz web/src/modules/auth/pages/OAuthCallbackPage.tsx).
        res.redirect(`${frontendUrl}/auth/callback?error=oauth_failed&provider=${provider}`);
      }
    };

  return {
    redirectToGoogle: redirectToProvider('google', googleVerifier),
    handleGoogleCallback: handleCallback('google', googleVerifier),
    redirectToFacebook: redirectToProvider('facebook', facebookVerifier),
    handleFacebookCallback: handleCallback('facebook', facebookVerifier),
  };
};
