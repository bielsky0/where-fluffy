// HTTP load test: authenticated comment creation, POST /api/v1/pets/:petId/comments.
//
// Run from the repo root with the app + docker compose infra already up:
//   k6 run tests/perf/k6/load-test.ts
//   k6 run -e BASE_URL=https://staging.example.com tests/perf/k6/load-test.ts
//
// Requires k6 v0.54+ (native TypeScript support, no bundler step needed).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { API_URL } from './helpers/config.ts';
import { registerUser, loginUser, createPet, TestUser } from './helpers/http-auth.ts';

// Only 5 entries on purpose: auth.routes.ts caps POST /auth/login at 5 req/60s per IP
// (blockDuration 300s), and every request in this k6 run shares one source IP. setup() logs
// each of these in once; if you need more parallelism, cycle VUs across this same pool instead
// of logging in more users — see comments below.
const users = new SharedArray<TestUser>('users', () => JSON.parse(open('./data/users.json')));

export const options: Options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp-up: 0 -> 50 VUs
    { duration: '1m', target: 50 },  // steady state: hold 50 VUs
    { duration: '30s', target: 0 },  // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

type SetupData = {
  cookies: string[]; // "token=<jwt>", one per test user, indexed same as `users`
  petId: string;
};

export function setup(): SetupData {
  const cookies = users.map((user) => {
    registerUser(user);
    return loginUser(user.email, user.password).cookie;
  });

  // Comments require a real, existing pet (comments.service.ts checks pet existence via
  // PetRepository before inserting) — create one target pet up front and have every VU comment
  // on it, rather than creating a pet per VU/iteration and inflating write volume unrelated to
  // what we're actually trying to measure.
  const petId = createPet(cookies[0], 'Perf Test Fluffy');

  return { cookies, petId };
}

export default function (data: SetupData): void {
  // Round-robin across the 5 pre-authenticated sessions instead of logging in per-VU — see the
  // rate-limit comment above `users`.
  const cookie = data.cookies[__VU % data.cookies.length];

  const payload = JSON.stringify({
    message: `Spotted near the park at ${new Date().toISOString()}`,
    type: 'sighted',
    latitude: 52.2297 + (Math.random() - 0.5) * 0.01,
    longitude: 21.0122 + (Math.random() - 0.5) * 0.01,
  });

  const res = http.post(`${API_URL}/pets/${data.petId}/comments`, payload, {
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    tags: { name: 'CreateComment' },
  });

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response has comment id': (r) => {
      try {
        return typeof (r.json() as { id?: string }).id === 'string';
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
