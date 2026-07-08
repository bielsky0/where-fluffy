import http, { RefinedResponse, ResponseType } from 'k6/http';
import { API_URL } from './config.ts';

export type TestUser = { email: string; password: string; name: string };

// auth.controller.ts's loginUser never puts the token in the JSON body — it's set via
// res.cookie('token', ...) (httpOnly). k6's http module *does* have an automatic per-VU cookie
// jar, but setup() runs in its own isolated context that isn't shared with VU jars, and this
// app's login rate limiter (5 req/60s per IP, see auth.routes.ts) means every VU logging in for
// itself mid-test would immediately 429 since all VUs share k6's source IP. So: log in once per
// test user inside setup(), pull the `token=<jwt>` pair straight out of Set-Cookie, and hand it
// to every VU as a plain header string they attach to each request themselves.
const extractTokenCookie = (res: RefinedResponse<ResponseType | undefined>): string => {
  const setCookie = res.headers['Set-Cookie'];
  if (!setCookie) {
    throw new Error(`Expected a Set-Cookie header, got none (status ${res.status}): ${res.body}`);
  }
  const match = /^([^=]+=[^;]+)/.exec(setCookie);
  if (!match) {
    throw new Error(`Could not parse 'token' cookie out of Set-Cookie: ${setCookie}`);
  }
  return match[1]; // "token=<jwt>"
};

export type LoginResult = { cookie: string; userId: string };

export const loginUser = (email: string, password: string): LoginResult => {
  const res = http.post(`${API_URL}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${res.body}`);
  }
  const body = res.json() as { user: { id: string } };
  return { cookie: extractTokenCookie(res), userId: body.user.id };
};

// Returns the new user's id. auth.controller.ts's registerUser responds 201 with the created
// user (id included, password stripped) — no separate login call needed on the happy path.
// auth/auth.routes.ts's POST /register carries no dedicated rate limiter of its own (only
// /login does, 5 req/60s per IP — see loginUser above), so re-registering the same fixed seed
// emails across repeated runs of this script is the only path that falls back to login().
export const registerUser = (user: TestUser): string => {
  const res = http.post(`${API_URL}/auth/register`, JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 201) {
    return (res.json() as { id: string }).id;
  }
  if (res.status === 400) {
    // Most likely EMAIL_ALREADY_EXISTS from a previous run against the same seed data —
    // this DOES count against the /login rate-limit budget, so don't rely on it on every run.
    return loginUser(user.email, user.password).userId;
  }
  throw new Error(`Unexpected register failure for ${user.email}: ${res.status} ${res.body}`);
};

export const createPet = (cookie: string, name: string): string => {
  const res = http.post(
    `${API_URL}/pets`,
    JSON.stringify({
      name,
      species: 'dog',
      location: { lat: 52.2297, lng: 21.0122 }, // Warsaw — arbitrary, just needs to pass createPetSchema
      reward: 0,
    }),
    { headers: { 'Content-Type': 'application/json', Cookie: cookie } },
  );
  if (res.status !== 201) {
    throw new Error(`Pet creation failed: ${res.status} ${res.body}`);
  }
  const body = res.json() as { id: string };
  return body.id;
};
