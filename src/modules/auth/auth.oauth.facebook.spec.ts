import { createFacebookOAuthVerifier } from './auth.oauth.facebook.js';

describe('createFacebookOAuthVerifier', () => {
  const config = {
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
    redirectUri: 'http://localhost:3000/api/v1/auth/facebook/callback',
  };

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds an authorization URL carrying the given state and the expected scope', () => {
    const verifier = createFacebookOAuthVerifier(config);

    const url = new URL(verifier.getAuthorizationUrl('nonce-123'));

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v19.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe(config.appId);
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('state')).toBe('nonce-123');
    expect(url.searchParams.get('scope')).toBe('email,public_profile');
  });

  it('exchanges a code for a verified profile', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'fb-access-token' }) })
      .mockResolvedValueOnce({ json: async () => ({ id: 'fb-id-1', name: 'Jane Doe', email: 'jane@fb.com' }) });
    global.fetch = mockFetch as unknown as typeof fetch;
    const verifier = createFacebookOAuthVerifier(config);

    const profile = await verifier.exchangeCodeForProfile('auth-code');

    expect(profile).toEqual({ providerId: 'fb-id-1', email: 'jane@fb.com', name: 'Jane Doe' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects with OAUTH_TOKEN_MISSING when Facebook does not return an access_token', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce({ json: async () => ({}) });
    global.fetch = mockFetch as unknown as typeof fetch;
    const verifier = createFacebookOAuthVerifier(config);

    await expect(verifier.exchangeCodeForProfile('auth-code')).rejects.toMatchObject({
      statusCode: 502,
      code: 'OAUTH_TOKEN_MISSING',
    });
  });

  it('rejects with OAUTH_EMAIL_MISSING when the profile has no granted email', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'fb-access-token' }) })
      .mockResolvedValueOnce({ json: async () => ({ id: 'fb-id-1', name: 'Jane Doe' }) });
    global.fetch = mockFetch as unknown as typeof fetch;
    const verifier = createFacebookOAuthVerifier(config);

    await expect(verifier.exchangeCodeForProfile('auth-code')).rejects.toMatchObject({
      statusCode: 400,
      code: 'OAUTH_EMAIL_MISSING',
    });
  });
});
