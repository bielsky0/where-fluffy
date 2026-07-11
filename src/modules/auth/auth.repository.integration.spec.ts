import path from 'node:path';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createAuthRepository } from './auth.repository.js';
import { AuthRepository, EMAIL_ALREADY_EXISTS_ERROR } from './interface/auth.interface.js';
import { RegisterDTO } from './dto/register.dto.js';

jest.setTimeout(120_000);

const SRC_ROOT = path.resolve(__dirname, '../../');

describe('createAuthRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: AuthRepository;

  beforeAll(async () => {
    // "where-fluffy/postgres-ai:16" (infra/db/Dockerfile) — postgis/postgis:16-3.4 plus pgvector.
    container = await new PostgreSqlContainer('where-fluffy/postgres-ai:16')
      .withDatabase('fluffy_auth_test')
      .withUsername('test')
      .withPassword('test')
      .withCopyFilesToContainer([
        {
          source: path.resolve(SRC_ROOT, '../init-scripts/01-init-postgis.sql'),
          target: '/docker-entrypoint-initdb.d/01-init-postgis.sql',
        },
        {
          source: path.resolve(SRC_ROOT, '../init-scripts/03-init-pgvector.sql'),
          target: '/docker-entrypoint-initdb.d/03-init-pgvector.sql',
        },
      ])
      .start();

    const databaseUrl = container.getConnectionUri();

    // Synchronizujemy cały schema.prisma (nie tylko User) bezpośrednio, tak samo jak w
    // pets.repository.integration.spec.ts — db push diffs/creates the entire schema, including
    // Pet's PostGIS geography column and vector(768) embedding column, regardless of which
    // model(s) this file actually tests.
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: SRC_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repository = createAuthRepository(prisma);
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  const buildRegisterDto = (overrides: Partial<Required<RegisterDTO>> = {}): Required<RegisterDTO> => ({
    email: 'jane@example.com',
    password: 'already-hashed-value',
    name: 'Jane Doe',
    ...overrides,
  });

  describe('create', () => {
    it('persists a user and returns it with a generated id and real timestamps', async () => {
      const user = await repository.create(buildRegisterDto());

      expect(user.id).toEqual(expect.any(String));
      expect(user.id).not.toHaveLength(0);
      expect(user.email).toBe('jane@example.com');
      expect(user.name).toBe('Jane Doe');
      expect(user.password).toBe('already-hashed-value');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('translates a duplicate-email unique constraint violation into a typed, non-Prisma error', async () => {
      await repository.create(buildRegisterDto({ email: 'dup@example.com' }));

      await expect(repository.create(buildRegisterDto({ email: 'dup@example.com' }))).rejects.toThrow(
        EMAIL_ALREADY_EXISTS_ERROR,
      );
    });
  });

  describe('findByEmail', () => {
    it('returns the matching user when one exists', async () => {
      const created = await repository.create(buildRegisterDto({ email: 'found@example.com' }));

      const found = await repository.findByEmail('found@example.com');

      expect(found).toEqual(created);
    });

    it('returns null when no user matches the email', async () => {
      const found = await repository.findByEmail('nobody@example.com');

      expect(found).toBeNull();
    });

    it('is case-sensitive on email, matching the unique index as declared in schema.prisma', async () => {
      await repository.create(buildRegisterDto({ email: 'case@example.com' }));

      const found = await repository.findByEmail('CASE@example.com');

      expect(found).toBeNull();
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('creates a new, real (non-ghost) user on first OAuth login', async () => {
      const user = await repository.findOrCreateOAuthUser('google', 'google-sub-1', 'oauth@example.com', 'Jane Doe');

      expect(user.email).toBe('oauth@example.com');
      expect(user.name).toBe('Jane Doe');
      expect(user.provider).toBe('google');
      expect(user.providerId).toBe('google-sub-1');
      expect(user.emailVerified).toBe(true);
      expect(user.isGhost).toBe(false);
      expect(user.password).toBeNull();
    });

    it('returns the same user on a repeat login with the same provider identity', async () => {
      const first = await repository.findOrCreateOAuthUser('google', 'google-sub-2', 'repeat@example.com', 'Jane Doe');

      const second = await repository.findOrCreateOAuthUser('google', 'google-sub-2', 'repeat@example.com', 'Jane Doe');

      expect(second.id).toBe(first.id);
    });

    it('links the OAuth identity onto an existing password account with the same email instead of creating a duplicate', async () => {
      const passwordUser = await repository.create(buildRegisterDto({ email: 'linked@example.com' }));

      const linked = await repository.findOrCreateOAuthUser('google', 'google-sub-3', 'linked@example.com', 'Jane Doe');

      expect(linked.id).toBe(passwordUser.id);
      expect(linked.provider).toBe('google');
      expect(linked.providerId).toBe('google-sub-3');
      expect(linked.emailVerified).toBe(true);
      expect(linked.password).toBe('already-hashed-value'); // niedotknięte przez dowiązanie
    });
  });
});
