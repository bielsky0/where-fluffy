import { z } from 'zod';

// Mirrors location.config.ts's Zod-validated env pattern — every field has a .default() so
// import never throws in local dev without real provider credentials; the OAuth routes simply
// won't produce a working consent screen until real client id/secret values are set.
//
// GOOGLE_OAUTH_ENABLED / FACEBOOK_OAUTH_ENABLED: per-provider kill switch. Flipping either to
// "false" and restarting the API immediately stops that provider's /auth/<provider> route from
// starting a new OAuth attempt (see auth.oauth.controller.ts's redirectToProvider) — no frontend
// redeploy needed, since the frontend doesn't read a mirrored flag; it always renders both
// buttons and, worst case during an incident, gets bounced straight back with a clear error
// (see web/src/modules/auth/pages/OAuthCallbackPage.tsx). Email OTP has no equivalent switch —
// it's the fallback of last resort and should stay reachable even with both providers disabled.
const oauthEnvSchema = z.object({
  BACKEND_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_OAUTH_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),
  FACEBOOK_OAUTH_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
});

const env = oauthEnvSchema.parse(process.env);

export const oauthConfig = {
  frontendUrl: env.FRONTEND_URL,
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.BACKEND_PUBLIC_URL}/api/v1/auth/google/callback`,
    enabled: env.GOOGLE_OAUTH_ENABLED,
  },
  facebook: {
    appId: env.FACEBOOK_APP_ID,
    appSecret: env.FACEBOOK_APP_SECRET,
    redirectUri: `${env.BACKEND_PUBLIC_URL}/api/v1/auth/facebook/callback`,
    enabled: env.FACEBOOK_OAUTH_ENABLED,
  },
};
