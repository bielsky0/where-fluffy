import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient, User, Pet } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createCommentsRepository } from './comments.repository.js';
import { CommentsRepository } from './interfaces/comment.interface.js';
import { CreateCommentDTO } from './dto/create-comment.dto.js';

jest.setTimeout(120_000);

const SRC_ROOT = path.resolve(__dirname, '../../');

describe('createCommentsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: CommentsRepository;
  let author: User;
  let pet: Pet;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
      .withDatabase('fluffy_comments_test')
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

    // Synchronizujemy schemat bezpośrednio ze schema.prisma (a nie przez historię migracji,
    // która ma lukę — brak kolumny "reward" na Pet mimo że schema.prisma ją deklaruje).
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: SRC_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repository = createCommentsRepository(prisma);

    author = await prisma.user.create({
      data: { email: 'author@fixture.test', password: 'irrelevant-hash', name: 'Jane Doe' },
    });
    // Comment.petId ma FK do Pet — tylko istnienie wiersza jest tu istotne. Pet.location
    // (Unsupported("geography")) zostaje NULL, bo standardowy prisma.pet.create() i tak nie
    // potrafi go zapisać (patrz CLAUDE.md); te testy weryfikują wyłącznie repozytorium Comment.
    pet = await prisma.pet.create({
      data: { name: 'Rex', species: 'dog', ownerId: author.id },
    });
  });

  afterEach(async () => {
    await prisma.comment.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  const buildDto = (overrides: Partial<CreateCommentDTO> = {}): CreateCommentDTO => ({
    message: 'Widziałem go koło parku',
    type: 'sighted',
    latitude: 52.2297,
    longitude: 21.0122,
    petId: pet.id,
    userId: author.id,
    ...overrides,
  });

  describe('create', () => {
    it('persists a comment with coordinates and returns it joined with the author', async () => {
      const comment = await repository.create(buildDto());

      expect(comment.id).toEqual(expect.any(String));
      expect(comment.id).not.toHaveLength(0);
      expect(comment.message).toBe('Widziałem go koło parku');
      expect(comment.type).toBe('sighted');
      expect(comment.petId).toBe(pet.id);
      expect(comment.userId).toBe(author.id);
      expect(comment.latitude).toBeCloseTo(52.2297, 5);
      expect(comment.longitude).toBeCloseTo(21.0122, 5);
      expect(comment.author).toEqual({ id: author.id, name: 'Jane Doe' });
      expect(comment.createdAt).toBeInstanceOf(Date);
      expect(comment.updatedAt).toBeInstanceOf(Date);
    });

    it('persists a comment without coordinates as a null location', async () => {
      const comment = await repository.create(
        buildDto({ type: 'general', latitude: undefined, longitude: undefined }),
      );

      expect(comment.latitude).toBeNull();
      expect(comment.longitude).toBeNull();
    });

    it('persists a comment with latitude 0 (equator) as a real coordinate, not null (regression guard)', async () => {
      const comment = await repository.create(buildDto({ latitude: 0 }));

      expect(comment.latitude).toBe(0);
      expect(comment.longitude).toBeCloseTo(21.0122, 5);
    });
  });

  describe('findByPetId', () => {
    it('returns comments for the given pet, ordered by createdAt descending', async () => {
      const first = await repository.create(buildDto({ message: 'Pierwszy' }));
      // Pod obciążeniem (np. gdy kilka plików *.integration.spec.ts odpala własne kontenery
      // równolegle) dwa kolejne INSERT-y potrafią wylądować z tym samym mikrosekundowym
      // "createdAt", co czyni ORDER BY niedeterministycznym — stąd jawny, minimalny odstęp.
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await repository.create(buildDto({ message: 'Drugi' }));

      const results = await repository.findByPetId(pet.id);

      expect(results.map((c) => c.id)).toEqual([second.id, first.id]);
    });

    it('returns an empty array for a pet with no comments', async () => {
      const results = await repository.findByPetId(pet.id);

      expect(results).toEqual([]);
    });

    it('returns an empty array for a non-existent petId, without throwing', async () => {
      const results = await repository.findByPetId(randomUUID());

      expect(results).toEqual([]);
    });
  });
});
