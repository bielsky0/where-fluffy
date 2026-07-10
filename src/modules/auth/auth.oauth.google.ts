import { OAuth2Client } from 'google-auth-library';
import { OAuthProfile, OAuthVerifier } from './interface/auth.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';

export const createGoogleOAuthVerifier = (config: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): OAuthVerifier => {
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);

  const getAuthorizationUrl = (state: string): string =>
    client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
    });

  const exchangeCodeForProfile = async (code: string): Promise<OAuthProfile> => {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw createAppError(502, 'Brak id_token od Google', true, 'OAUTH_TOKEN_MISSING');
    }

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw createAppError(502, 'Brak adresu e-mail od Google', true, 'OAUTH_EMAIL_MISSING');
    }

    return { providerId: payload.sub, email: payload.email, name: payload.name ?? 'Użytkownik Google' };
  };

  return { getAuthorizationUrl, exchangeCodeForProfile };
};
