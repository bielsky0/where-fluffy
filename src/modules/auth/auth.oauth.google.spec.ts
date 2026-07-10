import { OAuth2Client } from 'google-auth-library';
import { createGoogleOAuthVerifier } from './auth.oauth.google.js';

// Nigdy nie wywołujemy prawdziwego Google — mockujemy cały moduł google-auth-library, tak jak
// CLAUDE.md opisuje mockowanie repository/hasher/token zamiast prawdziwego Prisma/bcrypt/jwt.
jest.mock('google-auth-library');

const MockedOAuth2Client = OAuth2Client as jest.MockedClass<typeof OAuth2Client>;

describe('createGoogleOAuthVerifier', () => {
  const config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/api/v1/auth/google/callback',
  };

  beforeEach(() => {
    MockedOAuth2Client.mockClear();
  });

  it('builds an authorization URL carrying the given state and the expected scopes', () => {
    const generateAuthUrl = jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?...');
    MockedOAuth2Client.mockImplementation(
      () => ({ generateAuthUrl }) as unknown as OAuth2Client,
    );
    const verifier = createGoogleOAuthVerifier(config);

    const url = verifier.getAuthorizationUrl('nonce-123');

    expect(generateAuthUrl).toHaveBeenCalledWith({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state: 'nonce-123',
    });
    expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?...');
  });

  it('exchanges a code for a verified profile', async () => {
    const getToken = jest.fn().mockResolvedValue({ tokens: { id_token: 'fake-id-token' } });
    const getPayload = jest.fn().mockReturnValue({ sub: 'google-sub-1', email: 'jane@gmail.com', name: 'Jane Doe' });
    const verifyIdToken = jest.fn().mockResolvedValue({ getPayload });
    MockedOAuth2Client.mockImplementation(
      () => ({ getToken, verifyIdToken }) as unknown as OAuth2Client,
    );
    const verifier = createGoogleOAuthVerifier(config);

    const profile = await verifier.exchangeCodeForProfile('auth-code');

    expect(getToken).toHaveBeenCalledWith('auth-code');
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'fake-id-token', audience: config.clientId });
    expect(profile).toEqual({ providerId: 'google-sub-1', email: 'jane@gmail.com', name: 'Jane Doe' });
  });

  it('rejects with OAUTH_TOKEN_MISSING when Google does not return an id_token', async () => {
    const getToken = jest.fn().mockResolvedValue({ tokens: {} });
    MockedOAuth2Client.mockImplementation(() => ({ getToken }) as unknown as OAuth2Client);
    const verifier = createGoogleOAuthVerifier(config);

    await expect(verifier.exchangeCodeForProfile('auth-code')).rejects.toMatchObject({
      statusCode: 502,
      code: 'OAUTH_TOKEN_MISSING',
    });
  });

  it('rejects with OAUTH_EMAIL_MISSING when the verified payload has no email', async () => {
    const getToken = jest.fn().mockResolvedValue({ tokens: { id_token: 'fake-id-token' } });
    const getPayload = jest.fn().mockReturnValue({ sub: 'google-sub-1' });
    const verifyIdToken = jest.fn().mockResolvedValue({ getPayload });
    MockedOAuth2Client.mockImplementation(
      () => ({ getToken, verifyIdToken }) as unknown as OAuth2Client,
    );
    const verifier = createGoogleOAuthVerifier(config);

    await expect(verifier.exchangeCodeForProfile('auth-code')).rejects.toMatchObject({
      statusCode: 502,
      code: 'OAUTH_EMAIL_MISSING',
    });
  });
});
