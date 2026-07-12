import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient, User } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createFeedRepository } from './feed.repository.js';
import { FeedRepository } from './interfaces/feed.interface.js';

jest.setTimeout(120_000);

// Warszawa — spójne z resztą projektu
const CENTER = { lat: 52.2297, lng: 21.0122 };
const NEAR = { lat: 52.2306, lng: 21.0122 }; // ~100m na północ od CENTER
const FAR = { lat: 52.3197, lng: 21.0122 }; // ~10km na północ od CENTER

const SRC_ROOT = path.resolve(__dirname, '../../');

describe('createFeedRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: FeedRepository;
  let owner: User;

  beforeAll(async () => {
    // "where-fluffy/postgres-ai:16" (infra/db/Dockerfile) — postgis/postgis:16-3.4 plus pgvector.
    // Required here even though this file never touches Pet.embedding: `db push` diffs/creates
    // the *entire* schema.prisma, including Pet's `embedding vector(768)` column, so every
    // integration test's Postgres needs pgvector available, not just pets/search's.
    container = await new PostgreSqlContainer('where-fluffy/postgres-ai:16')
      .withDatabase('fluffy_test')
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

    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: SRC_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repository = createFeedRepository(prisma);

    owner = await prisma.user.create({
      data: { email: 'owner@feed-fixture.test', password: 'irrelevant-hash', name: 'Feed Fixture Owner' },
    });
  });

  afterEach(async () => {
    await prisma.pet.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  // findFeedPage doesn't write data — seed rows directly, sequencing createdAt explicitly via a
  // small setTimeout between inserts (same pattern comments.repository.integration.spec.ts uses)
  // so createdAt ordering is deterministic rather than racing on same-microsecond timestamps.
  const insertPet = async (
    overrides: { name?: string; status?: string; category?: string; location?: { lat: number; lng: number }; photoUrls?: string[] } = {},
  ) => {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Pet" (id, name, species, category, reward, "ownerId", status, location, "photoUrls", "updatedAt")
      VALUES (${id}, ${overrides.name ?? 'Rex'}, 'dog', ${overrides.category ?? 'dog'}, 0, ${owner.id},
              ${overrides.status ?? 'missing'},
              ST_SetSRID(ST_MakePoint(${(overrides.location ?? CENTER).lng}, ${(overrides.location ?? CENTER).lat}), 4326)::geography,
              ${overrides.photoUrls ?? []},
              now())
    `;
    return id;
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  describe('findFeedPage', () => {
    it('includes both missing and found pets within radius', async () => {
      const missingId = await insertPet({ status: 'missing' });
      const foundId = await insertPet({ status: 'found' });

      const { items } = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 20 });

      expect(items.map((p) => p.id).sort()).toEqual([foundId, missingId].sort());
    });

    it('excludes pets outside the radius', async () => {
      const nearId = await insertPet({ location: NEAR });
      await insertPet({ location: FAR });

      const { items } = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 20 });

      expect(items.map((p) => p.id)).toEqual([nearId]);
    });

    it('filters by category when provided', async () => {
      const dogId = await insertPet({ category: 'dog' });
      await insertPet({ category: 'cat' });

      const { items } = await repository.findFeedPage({
        lat: CENTER.lat,
        lng: CENTER.lng,
        radiusInMeters: 5000,
        category: 'dog',
        limit: 20,
      });

      expect(items.map((p) => p.id)).toEqual([dogId]);
    });

    it('orders by createdAt DESC and reports hasNextPage at the exact limit boundary', async () => {
      const firstId = await insertPet({ name: 'First' });
      await sleep(5);
      const secondId = await insertPet({ name: 'Second' });
      await sleep(5);
      const thirdId = await insertPet({ name: 'Third' });

      const page = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 2 });

      expect(page.items.map((p) => p.id)).toEqual([thirdId, secondId]);
      expect(page.hasNextPage).toBe(true);

      const fullPage = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 3 });
      expect(fullPage.items.map((p) => p.id)).toEqual([thirdId, secondId, firstId]);
      expect(fullPage.hasNextPage).toBe(false);
    });

    it('continues from a cursor with no overlap and no gaps across pages', async () => {
      const firstId = await insertPet({ name: 'First' });
      await sleep(5);
      const secondId = await insertPet({ name: 'Second' });
      await sleep(5);
      const thirdId = await insertPet({ name: 'Third' });
      await sleep(5);
      const fourthId = await insertPet({ name: 'Fourth' });

      const page1 = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 2 });
      expect(page1.items.map((p) => p.id)).toEqual([fourthId, thirdId]);
      expect(page1.hasNextPage).toBe(true);

      const lastItemOfPage1 = page1.items[page1.items.length - 1];
      const page2 = await repository.findFeedPage({
        lat: CENTER.lat,
        lng: CENTER.lng,
        radiusInMeters: 5000,
        limit: 2,
        cursor: { createdAt: lastItemOfPage1.createdAt.toISOString(), id: lastItemOfPage1.id },
      });

      expect(page2.items.map((p) => p.id)).toEqual([secondId, firstId]);
      expect(page2.hasNextPage).toBe(false);
    });

    it('computes distanceMeters as a numeric field', async () => {
      await insertPet({ location: NEAR });

      const { items } = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 20 });

      expect(typeof items[0].distanceMeters).toBe('number');
      expect(items[0].distanceMeters).toBeGreaterThan(0);
    });

    it('returns photoUrls', async () => {
      await insertPet({ location: NEAR, photoUrls: ['https://example.test/rex.jpg'] });

      const { items } = await repository.findFeedPage({ lat: CENTER.lat, lng: CENTER.lng, radiusInMeters: 5000, limit: 20 });

      expect(items[0].photoUrls).toEqual(['https://example.test/rex.jpg']);
    });

    // Map-viewport (bbox) mode — mutually exclusive with the radius mode exercised above.
    describe('bbox mode', () => {
      // Envelope roughly ~1km around CENTER on each side.
      const BBOX = { minLng: 21.0, minLat: 52.22, maxLng: 21.03, maxLat: 52.24 };

      it('includes pets inside the envelope and excludes pets outside it', async () => {
        const insideId = await insertPet({ location: NEAR });
        await insertPet({ location: FAR });

        const { items } = await repository.findFeedPage({ bbox: BBOX, limit: 20 });

        expect(items.map((p) => p.id)).toEqual([insideId]);
      });

      it('reports distanceMeters as null in bbox mode', async () => {
        await insertPet({ location: NEAR });

        const { items } = await repository.findFeedPage({ bbox: BBOX, limit: 20 });

        expect(items[0].distanceMeters).toBeNull();
      });

      it('combines correctly with cursor pagination', async () => {
        const firstId = await insertPet({ name: 'First', location: NEAR });
        await sleep(5);
        const secondId = await insertPet({ name: 'Second', location: NEAR });

        const page1 = await repository.findFeedPage({ bbox: BBOX, limit: 1 });
        expect(page1.items.map((p) => p.id)).toEqual([secondId]);
        expect(page1.hasNextPage).toBe(true);

        const lastItemOfPage1 = page1.items[page1.items.length - 1];
        const page2 = await repository.findFeedPage({
          bbox: BBOX,
          limit: 1,
          cursor: { createdAt: lastItemOfPage1.createdAt.toISOString(), id: lastItemOfPage1.id },
        });
        expect(page2.items.map((p) => p.id)).toEqual([firstId]);
        expect(page2.hasNextPage).toBe(false);
      });

      it('filters by category in bbox mode', async () => {
        const dogId = await insertPet({ category: 'dog', location: NEAR });
        await insertPet({ category: 'cat', location: NEAR });

        const { items } = await repository.findFeedPage({ bbox: BBOX, category: 'dog', limit: 20 });

        expect(items.map((p) => p.id)).toEqual([dogId]);
      });
    });
  });
});
