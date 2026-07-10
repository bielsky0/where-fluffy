import { OAuthProfile, OAuthVerifier } from './interface/auth.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';

// Brak oficjalnego, utrzymywanego SDK Node dla Facebooka — zwykły `fetch` (globalny w Node 18+)
// wystarcza dla trzech wywołań: URL autoryzacji, wymiana code->token, pobranie profilu.
// Sprawdź aktualną wersję Graph API w Meta for Developers przed produkcją.
const GRAPH_VERSION = 'v19.0';

export const createFacebookOAuthVerifier = (config: {
  appId: string;
  appSecret: string;
  redirectUri: string;
}): OAuthVerifier => {
  const getAuthorizationUrl = (state: string): string => {
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set('client_id', config.appId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'email,public_profile');
    return url.toString();
  };

  const exchangeCodeForProfile = async (code: string): Promise<OAuthProfile> => {
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', config.appId);
    tokenUrl.searchParams.set('client_secret', config.appSecret);
    tokenUrl.searchParams.set('redirect_uri', config.redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl);
    const tokenBody = (await tokenRes.json()) as { access_token?: string };
    if (!tokenBody.access_token) {
      throw createAppError(502, 'Nie udało się uzyskać tokenu Facebooka', true, 'OAUTH_TOKEN_MISSING');
    }

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email');
    profileUrl.searchParams.set('access_token', tokenBody.access_token);

    const profileRes = await fetch(profileUrl);
    const profile = (await profileRes.json()) as { id: string; name: string; email?: string };
    if (!profile.email) {
      // Konto FB bez zweryfikowanego e-maila (rzadkie, ale możliwe) — nasz model User wymaga
      // e-maila jako podstawy łączenia kont, więc traktujemy to jako twardy błąd, nie fallback.
      throw createAppError(400, 'To konto Facebook nie ma zweryfikowanego adresu e-mail', true, 'OAUTH_EMAIL_MISSING');
    }

    return { providerId: profile.id, email: profile.email, name: profile.name };
  };

  return { getAuthorizationUrl, exchangeCodeForProfile };
};
