import express, { Response, NextFunction } from 'express';
import request from 'supertest';
import { createRequireAdmin } from './require-admin.middleware.js';
import { AuthenticatedRequest } from './auth.middleware.js';
import { errorHandler } from './error.middleware.js';

// Ten sam wzorzec co pets.controller.spec.ts: minimalna, samodzielna apka Express, req.user
// wstrzykiwany bezpośrednio zamiast prawdziwego middleware'u authenticate.
const fakeAuthenticate =
  (email?: string) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (email) req.user = { id: 'user-1', email, name: 'Test User' };
    next();
  };

const buildTestApp = (email: string | undefined, adminEmails: Set<string>) => {
  const app = express();
  app.get('/admin-only', fakeAuthenticate(email), createRequireAdmin(adminEmails), (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use(errorHandler);
  return app;
};

describe('createRequireAdmin', () => {
  it('calls next() for a request whose req.user.email is on the allowlist', async () => {
    const app = buildTestApp('admin@example.com', new Set(['admin@example.com']));

    const response = await request(app).get('/admin-only');

    expect(response.status).toBe(200);
  });

  it('returns 403 for an authenticated user whose email is not on the allowlist', async () => {
    const app = buildTestApp('someone@example.com', new Set(['admin@example.com']));

    const response = await request(app).get('/admin-only');

    expect(response.status).toBe(403);
  });

  it('matches the allowlist case-insensitively', async () => {
    const app = buildTestApp('Admin@Example.com', new Set(['admin@example.com']));

    const response = await request(app).get('/admin-only');

    expect(response.status).toBe(200);
  });

  it('returns 403 rather than crashing when req.user is not set at all', async () => {
    const app = buildTestApp(undefined, new Set(['admin@example.com']));

    const response = await request(app).get('/admin-only');

    expect(response.status).toBe(403);
  });
});
