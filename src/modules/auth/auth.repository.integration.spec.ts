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
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
      .withDatabase('fluffy_auth_test')
      .withUsername('test')
      .withPassword('test')
      .withCopyFilesToContainer([
        {
          source: path.resolve(SRC_ROOT, '../init-scripts/01-init-postgis.sql'),
          target: '/docker-entrypoint-initdb.d/01-init-postgis.sql',
        },
      ])
      .start();

    const databaseUrl = container.getConnectionUri();

    // Synchronizujemy cały schema.prisma (nie tylko User) bezpośrednio, tak samo jak w
    // pets.repository.integration.spec.ts — extensions=[postgis] w schema.prisma wymaga obrazu
    // z PostGIS niezależnie od tego, że ten plik testuje tylko model User.
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
});
