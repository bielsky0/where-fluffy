import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient, User } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createSearchRepository } from './search.repository.js';
import { SearchRepository } from './interfaces/search.interface.js';
import { createFakeEmbeddingProvider } from '../../shared/embedding/fake-embedding.provider.js';

jest.setTimeout(120_000);

const CENTER = { lat: 52.2297, lng: 21.0122 };
const SRC_ROOT = path.resolve(__dirname, '../../');
const DIMENSIONS = 768;

describe('createSearchRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: SearchRepository;
  let owner: User;
  // Wektory z FakeEmbeddingProvider — deterministyczne, więc "friendly dog"/"golden retriever
  // lost" naprawdę lądują bliżej siebie w przestrzeni kosinusowej niż "shy black cat", co
  // pozwala asercjom na sensowną kolejność bez prawdziwego modelu.
  const embeddingProvider = createFakeEmbeddingProvider(DIMENSIONS);

  beforeAll(async () => {
    // "where-fluffy/postgres-ai:16" (infra/db/Dockerfile) — postgis/postgis:16-3.4 plus pgvector,
    // needed for the embedding <=> cosine-distance queries under test here. Must be built
    // locally first (`docker compose build db`).
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
    repository = createSearchRepository(prisma);

    owner = await prisma.user.create({
      data: { email: 'owner@search-fixture.test', password: 'irrelevant-hash', name: 'Search Fixture Owner' },
    });
  });

  afterEach(async () => {
    await prisma.pet.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  const insertPet = async (overrides: {
    status?: string;
    text?: string;
    embedding?: number[] | null;
  } = {}): Promise<string> => {
    const id = randomUUID();
    const vector = overrides.embedding === undefined ? await embeddingProvider.generateEmbedding(overrides.text ?? 'dog') : overrides.embedding;
    const embeddingFragment = vector === null ? 'NULL' : `'[${vector.join(',')}]'::vector`;

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pet" (id, name, species, category, reward, "ownerId", status, location, embedding, "updatedAt")
      VALUES ('${id}', 'Rex', 'dog', 'dog', 0, '${owner.id}', '${overrides.status ?? 'missing'}',
              ST_SetSRID(ST_MakePoint(${CENTER.lng}, ${CENTER.lat}), 4326)::geography,
              ${embeddingFragment}, now())
    `);

    return id;
  };

  describe('findSimilar', () => {
    it('ranks results by cosine distance to the query vector, closest first', async () => {
      const dogId = await insertPet({ text: 'friendly golden retriever, good with kids' });
      const catId = await insertPet({ text: 'shy black cat, hides from strangers' });

      const queryVector = await embeddingProvider.generateEmbedding('friendly golden retriever, good with kids');
      const results = await repository.findSimilar(queryVector, 10);

      expect(results.map((r) => r.id)).toEqual([dogId, catId]);
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it('excludes pets with a NULL embedding', async () => {
      const embeddedId = await insertPet({ text: 'lost dog' });
      await insertPet({ embedding: null });

      const queryVector = await embeddingProvider.generateEmbedding('lost dog');
      const results = await repository.findSimilar(queryVector, 10);

      expect(results.map((r) => r.id)).toEqual([embeddedId]);
    });

    it('excludes pets whose status is not "missing"', async () => {
      const missingId = await insertPet({ text: 'lost dog', status: 'missing' });
      await insertPet({ text: 'lost dog', status: 'found' });

      const queryVector = await embeddingProvider.generateEmbedding('lost dog');
      const results = await repository.findSimilar(queryVector, 10);

      expect(results.map((r) => r.id)).toEqual([missingId]);
    });

    it('caps the result count at limit', async () => {
      await insertPet({ text: 'dog one' });
      await insertPet({ text: 'dog two' });
      await insertPet({ text: 'dog three' });

      const queryVector = await embeddingProvider.generateEmbedding('dog');
      const results = await repository.findSimilar(queryVector, 2);

      expect(results).toHaveLength(2);
    });
  });
});
