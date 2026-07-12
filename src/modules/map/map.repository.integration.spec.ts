import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient, User } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createMapRepository } from './map.repository.js';
import { MapRepository } from './interfaces/map.interface.js';

jest.setTimeout(120_000);

// Warszawa — spójne z resztą projektu
const CENTER = { lat: 52.2297, lng: 21.0122 };
const NEAR = { lat: 52.2306, lng: 21.0122 }; // ~100m na północ od CENTER
const FAR = { lat: 52.3197, lng: 21.0122 }; // ~10km na północ od CENTER

const BBOX = { minLng: 21.0, minLat: 52.22, maxLng: 21.03, maxLat: 52.24 };

const SRC_ROOT = path.resolve(__dirname, '../../');

describe('createMapRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: MapRepository;
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
    repository = createMapRepository(prisma);

    owner = await prisma.user.create({
      data: { email: 'owner@map-fixture.test', password: 'irrelevant-hash', name: 'Map Fixture Owner' },
    });
  });

  afterEach(async () => {
    await prisma.pet.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  const insertPet = async (overrides: { status?: string; category?: string; location?: { lat: number; lng: number } } = {}) => {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Pet" (id, name, species, category, reward, "ownerId", status, location, "updatedAt")
      VALUES (${id}, 'Rex', 'dog', ${overrides.category ?? 'dog'}, 0, ${owner.id},
              ${overrides.status ?? 'missing'},
              ST_SetSRID(ST_MakePoint(${(overrides.location ?? CENTER).lng}, ${(overrides.location ?? CENTER).lat}), 4326)::geography,
              now())
    `;
    return id;
  };

  describe('findPins (bbox mode)', () => {
    it('includes pets inside the envelope and excludes pets outside it', async () => {
      const insideId = await insertPet({ location: NEAR });
      await insertPet({ location: FAR });

      const pins = await repository.findPins({ bbox: BBOX });

      expect(pins.map((p) => p.id)).toEqual([insideId]);
    });

    it('returns the flat {id, lat, lng, status, category} shape', async () => {
      const id = await insertPet({ location: NEAR, status: 'found', category: 'dog' });

      const [pin] = await repository.findPins({ bbox: BBOX });

      expect(pin).toEqual({
        id,
        lat: expect.any(Number),
        lng: expect.any(Number),
        status: 'found',
        category: 'dog',
      });
    });

    it('filters by category when provided', async () => {
      const dogId = await insertPet({ category: 'dog', location: NEAR });
      await insertPet({ category: 'cat', location: NEAR });

      const pins = await repository.findPins({ bbox: BBOX, category: 'dog' });

      expect(pins.map((p) => p.id)).toEqual([dogId]);
    });
  });

  describe('findPins (radius mode)', () => {
    it('includes pets within the radius and excludes pets outside it', async () => {
      const insideId = await insertPet({ location: NEAR });
      await insertPet({ location: FAR });

      const pins = await repository.findPins({ ...CENTER, radiusInMeters: 1000 });

      expect(pins.map((p) => p.id)).toEqual([insideId]);
    });

    it('filters by category when provided', async () => {
      const dogId = await insertPet({ category: 'dog', location: NEAR });
      await insertPet({ category: 'cat', location: NEAR });

      const pins = await repository.findPins({ ...CENTER, radiusInMeters: 1000, category: 'dog' });

      expect(pins.map((p) => p.id)).toEqual([dogId]);
    });
  });

  describe('getStats', () => {
    it('returns total/missing/found counts within the radius', async () => {
      await insertPet({ location: NEAR, status: 'missing' });
      await insertPet({ location: NEAR, status: 'found' });
      await insertPet({ location: FAR, status: 'missing' }); // outside radius, excluded

      const stats = await repository.getStats({ ...CENTER, radiusInMeters: 1000 });

      expect(stats).toEqual({ total: 2, missing: 1, found: 1 });
    });

    it('filters by category when provided', async () => {
      await insertPet({ location: NEAR, status: 'missing', category: 'dog' });
      await insertPet({ location: NEAR, status: 'missing', category: 'cat' });

      const stats = await repository.getStats({ ...CENTER, radiusInMeters: 1000, category: 'dog' });

      expect(stats).toEqual({ total: 1, missing: 1, found: 0 });
    });
  });
});
