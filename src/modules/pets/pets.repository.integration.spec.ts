import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient, User } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPetRepository } from './pets.repository.js';
import { PetRepository } from './interfaces/pets.interface.js';
import { CreatePetRecordDTO } from './dto/create-pet.dto.js';

jest.setTimeout(120_000);

// Warszawa — spójne z resztą projektu (patrz konwersacja/curl-e w tej sesji)
const CENTER = { lat: 52.2297, lng: 21.0122 };
// ~100m na północ od CENTER (1 stopień szerokości ≈ 111 320m)
const NEAR = { lat: 52.2306, lng: 21.0122 };
// ~10km na północ od CENTER — jednoznacznie poza jakimkolwiek promieniem użytym w testach
const FAR = { lat: 52.3197, lng: 21.0122 };

const SRC_ROOT = path.resolve(__dirname, '../../');

describe('createPetRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PetRepository;
  let owner: User;

  beforeAll(async () => {
    // "where-fluffy/postgres-ai:16" (infra/db/Dockerfile) — postgis/postgis:16-3.4 plus the
    // pgvector extension package, needed here for the updateEmbedding tests below. Must be
    // built locally first (`docker compose build db`) — bare "postgis/postgis:16-3.4" has no
    // pgvector installed.
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

    // Synchronizujemy schemat bezpośrednio ze schema.prisma (a nie przez historię migracji,
    // która ma lukę — brak kolumny "reward" mimo że schema.prisma ją deklaruje).
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: SRC_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repository = createPetRepository(prisma);

    owner = await prisma.user.create({
      data: { email: 'owner@fixture.test', password: 'irrelevant-hash', name: 'Fixture Owner' },
    });
  });

  afterEach(async () => {
    await prisma.pet.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  const buildCreateDto = (overrides: Partial<CreatePetRecordDTO> = {}): CreatePetRecordDTO => ({
    name: 'Rex',
    species: 'dog',
    status: 'missing',
    category: 'dog',
    location: CENTER,
    reward: 100,
    phone: '600100200',
    photoUrls: [],
    city: null,
    ownerId: owner.id,
    ...overrides,
  });

  // Zgłoszenia "found" idą teraz przez to samo repository.save (status pochodzi z DTO, nie jest
  // już hardkodowany) — patrz buildCreateDto({ status: 'found' }) w testach poniżej.
  const insertFoundPetDirectly = async (location: { lat: number; lng: number }) => {
    await repository.save(buildCreateDto({ location, status: 'found', species: 'cat', category: 'cat', reward: 0 }));
  };

  describe('save', () => {
    it('inserts a pet with the given status and returns the persisted row', async () => {
      const pet = await repository.save(buildCreateDto({ reward: 250 }));

      expect(pet.id).toEqual(expect.any(String));
      expect(pet.id).not.toHaveLength(0);
      expect(pet.status).toBe('missing');
      expect(pet.reward).toBe(250);
      expect(pet.ownerId).toBe(owner.id);
      expect(pet.createdAt).toBeInstanceOf(Date);
      expect(pet.updatedAt).toBeInstanceOf(Date);
      expect(pet.location.lat).toBeCloseTo(CENTER.lat, 5);
      expect(pet.location.lng).toBeCloseTo(CENTER.lng, 5);
    });

    it('persists status "found" when passed, rather than always forcing "missing"', async () => {
      const pet = await repository.save(buildCreateDto({ status: 'found' }));

      expect(pet.status).toBe('found');
    });

    it('persists phone, distinguishingMarks, and photoUrl', async () => {
      const pet = await repository.save(
        buildCreateDto({ phone: '111222333', distinguishingMarks: 'Biała łatka na łapie', photoUrl: 'data:image/jpeg;base64,AAA' }),
      );

      expect(pet.phone).toBe('111222333');
      expect(pet.distinguishingMarks).toBe('Biała łatka na łapie');
      expect(pet.photoUrl).toBe('data:image/jpeg;base64,AAA');
    });

    it('persists photoUrls and city', async () => {
      const pet = await repository.save(
        buildCreateDto({ photoUrls: ['https://example.test/rex-1.jpg', 'https://example.test/rex-2.jpg'], city: 'Kraków' }),
      );

      expect(pet.photoUrls).toEqual(['https://example.test/rex-1.jpg', 'https://example.test/rex-2.jpg']);
      expect(pet.city).toBe('Kraków');
    });

    it('persists an empty photoUrls array and a null city when none are given', async () => {
      const pet = await repository.save(buildCreateDto());

      expect(pet.photoUrls).toEqual([]);
      expect(pet.city).toBeNull();
    });

    it('persists sourceUrl/originalContact/isAdminAdded (Content Seeding, admin-only path)', async () => {
      const pet = await repository.save(
        buildCreateDto({
          sourceUrl: 'https://facebook.com/groups/example/posts/123',
          originalContact: 'Jan Kowalski, 600 100 200',
          isAdminAdded: true,
        }),
      );

      expect(pet.sourceUrl).toBe('https://facebook.com/groups/example/posts/123');
      expect(pet.originalContact).toBe('Jan Kowalski, 600 100 200');
      expect(pet.isAdminAdded).toBe(true);
    });

    it('defaults isAdminAdded to false and sourceUrl/originalContact to null on the regular (non-admin) path', async () => {
      const pet = await repository.save(buildCreateDto());

      expect(pet.isAdminAdded).toBe(false);
      expect(pet.sourceUrl).toBeNull();
      expect(pet.originalContact).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the previously saved pet by id', async () => {
      const saved = await repository.save(buildCreateDto());

      const found = await repository.findById(saved.id);

      expect(found).toEqual(saved);
    });

    it('returns null for an id that does not exist', async () => {
      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    });
  });

  describe('findNearLocation', () => {
    it('excludes pets with status "found", even at the exact same coordinates', async () => {
      const missingPet = await repository.save(buildCreateDto({ location: CENTER }));
      await insertFoundPetDirectly(CENTER);

      const results = await repository.findNearLocation(CENTER.lat, CENTER.lng, 500);

      expect(results.map((p) => p.id)).toEqual([missingPet.id]);
    });

    it('includes pets within the radius and excludes pets outside it', async () => {
      const nearPet = await repository.save(buildCreateDto({ location: NEAR }));
      const farPet = await repository.save(buildCreateDto({ location: FAR }));

      const results = await repository.findNearLocation(CENTER.lat, CENTER.lng, 5000);

      const ids = results.map((p) => p.id);
      expect(ids).toContain(nearPet.id);
      expect(ids).not.toContain(farPet.id);
    });

    it('orders results by ascending distance from the query point', async () => {
      const farthest = await repository.save(
        buildCreateDto({ location: { lat: CENTER.lat + 0.018, lng: CENTER.lng } }), // ~2000m
      );
      const closest = await repository.save(
        buildCreateDto({ location: { lat: CENTER.lat + 0.00045, lng: CENTER.lng } }), // ~50m
      );
      const middle = await repository.save(
        buildCreateDto({ location: { lat: CENTER.lat + 0.0045, lng: CENTER.lng } }), // ~500m
      );

      const results = await repository.findNearLocation(CENTER.lat, CENTER.lng, 5000);

      expect(results.map((p) => p.id)).toEqual([closest.id, middle.id, farthest.id]);
    });

    it('returns an empty array when nothing is within range', async () => {
      await repository.save(buildCreateDto({ location: FAR }));

      const results = await repository.findNearLocation(CENTER.lat, CENTER.lng, 500);

      expect(results).toEqual([]);
    });

    it('filters by category when options.category is passed', async () => {
      const dog = await repository.save(buildCreateDto({ location: NEAR, category: 'dog' }));
      await repository.save(buildCreateDto({ location: NEAR, category: 'cat' }));

      const results = await repository.findNearLocation(CENTER.lat, CENTER.lng, 5000, { category: 'dog' });

      expect(results.map((p) => p.id)).toEqual([dog.id]);
    });

    it('caps the result count when options.limit is passed', async () => {
      await repository.save(buildCreateDto({ location: NEAR }));
      await repository.save(buildCreateDto({ location: NEAR }));
      await repository.save(buildCreateDto({ location: NEAR }));

      const results = await repository.findNearLocation(CENTER.lat, CENTER.lng, 5000, { limit: 2 });

      expect(results).toHaveLength(2);
    });
  });

  describe('updateEmbedding', () => {
    it('writes the vector and it is readable back via a raw SELECT', async () => {
      const pet = await repository.save(buildCreateDto());
      const vector = Array.from({ length: 768 }, (_, i) => i / 768);

      const result = await repository.updateEmbedding(pet.id, vector);

      expect(result).toBe('updated');
      const [row] = await prisma.$queryRaw<[{ embedding: string }]>`
        SELECT embedding::text as embedding FROM "Pet" WHERE id = ${pet.id}
      `;
      const persisted = row.embedding.slice(1, -1).split(',').map(Number);
      expect(persisted[0]).toBeCloseTo(vector[0], 5);
      expect(persisted[767]).toBeCloseTo(vector[767], 5);
    });

    it('overwrites a previously written vector (idempotent on repeated calls)', async () => {
      const pet = await repository.save(buildCreateDto());
      await repository.updateEmbedding(pet.id, Array(768).fill(0.1));

      const result = await repository.updateEmbedding(pet.id, Array(768).fill(0.9));

      expect(result).toBe('updated');
      const [row] = await prisma.$queryRaw<[{ embedding: string }]>`
        SELECT embedding::text as embedding FROM "Pet" WHERE id = ${pet.id}
      `;
      const persisted = row.embedding.slice(1, -1).split(',').map(Number);
      expect(persisted[0]).toBeCloseTo(0.9, 5);
    });

    it('returns "not_found" for an id that does not exist, without throwing', async () => {
      const result = await repository.updateEmbedding(randomUUID(), Array(768).fill(0.1));

      expect(result).toBe('not_found');
    });
  });

  describe('findSimilar', () => {
    // 768-wymiarowy wektor jednostkowy w kierunku osi `axis` — cosine distance między dwoma
    // takimi wektorami jest 0 (identyczne) gdy `axis` jest takie samo, i 1 (ortogonalne) gdy różne
    // — wystarczające, by rozróżnić "podobny"/"niepodobny" embedding w testach bez prawdziwego AI.
    const unitVector = (axis: number): number[] => Array.from({ length: 768 }, (_, i) => (i === axis ? 1 : 0));

    const saveWithEmbedding = async (overrides: Partial<CreatePetRecordDTO>, embeddingAxis: number) => {
      const pet = await repository.save(buildCreateDto(overrides));
      await repository.updateEmbedding(pet.id, unitVector(embeddingAxis));
      return pet;
    };

    it('ranks a near, embedding-similar candidate first', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);
      const similarNear = await saveWithEmbedding({ location: NEAR }, 0);
      const dissimilarNear = await saveWithEmbedding({ location: NEAR }, 1);

      const results = await repository.findSimilar(source.id, 5000, 4);

      expect(results.map((p) => p.id)).toEqual([similarNear.id, dissimilarNear.id]);
    });

    it('excludes the source pet itself', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);

      const results = await repository.findSimilar(source.id, 5000, 4);

      expect(results.map((p) => p.id)).not.toContain(source.id);
    });

    it('excludes candidates outside the radius, even with an identical embedding', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);
      await saveWithEmbedding({ location: FAR }, 0);

      const results = await repository.findSimilar(source.id, 5000, 4);

      expect(results).toEqual([]);
    });

    it('excludes candidates whose status is not "missing"', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);
      const candidate = await repository.save(buildCreateDto({ location: NEAR, status: 'found' }));
      await repository.updateEmbedding(candidate.id, unitVector(0));

      const results = await repository.findSimilar(source.id, 5000, 4);

      expect(results).toEqual([]);
    });

    it('excludes candidates without an embedding yet', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);
      await repository.save(buildCreateDto({ location: NEAR })); // never calls updateEmbedding

      const results = await repository.findSimilar(source.id, 5000, 4);

      expect(results).toEqual([]);
    });

    it('returns distanceMeters computed relative to the source pet', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);
      await saveWithEmbedding({ location: NEAR }, 0); // ~100m north of CENTER

      const [result] = await repository.findSimilar(source.id, 5000, 4);

      expect(result.distanceMeters).toBeGreaterThan(50);
      expect(result.distanceMeters).toBeLessThan(200);
    });

    it('respects the limit even when more candidates qualify', async () => {
      const source = await saveWithEmbedding({ location: CENTER }, 0);
      for (let i = 0; i < 5; i += 1) {
        await saveWithEmbedding({ location: NEAR }, 0);
      }

      const results = await repository.findSimilar(source.id, 5000, 2);

      expect(results).toHaveLength(2);
    });

    it('returns an empty array when the source petId does not exist', async () => {
      const results = await repository.findSimilar(randomUUID(), 5000, 4);

      expect(results).toEqual([]);
    });

    it('returns an empty array when the source pet has no embedding yet', async () => {
      const source = await repository.save(buildCreateDto({ location: CENTER })); // never calls updateEmbedding
      await saveWithEmbedding({ location: NEAR }, 0);

      const results = await repository.findSimilar(source.id, 5000, 4);

      expect(results).toEqual([]);
    });
  });

  describe('findByOwnerId', () => {
    it('returns only the given owner\'s pets, newest first', async () => {
      const otherOwner = await prisma.user.create({
        data: { email: 'other-owner@fixture.test', password: 'irrelevant-hash', name: 'Other Owner' },
      });
      const older = await repository.save(buildCreateDto({ name: 'Older' }));
      await new Promise((resolve) => setTimeout(resolve, 5)); // see CLAUDE.md's createdAt-ordering note
      const newer = await repository.save(buildCreateDto({ name: 'Newer' }));
      await repository.save(buildCreateDto({ name: 'Someone Else’s', ownerId: otherOwner.id }));

      const results = await repository.findByOwnerId(owner.id);

      expect(results.map((p) => p.id)).toEqual([newer.id, older.id]);
    });

    it('returns an empty array for an owner with no pets', async () => {
      const results = await repository.findByOwnerId(randomUUID());

      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    it('patches only the given columns, leaving the rest untouched', async () => {
      const pet = await repository.save(buildCreateDto({ name: 'Rex', reward: 100 }));

      const updated = await repository.update(pet.id, { name: 'Max' });

      expect(updated?.name).toBe('Max');
      expect(updated?.reward).toBe(100);
      expect(updated?.species).toBe(pet.species);
    });

    it('updates location via ST_SetSRID/ST_MakePoint', async () => {
      const pet = await repository.save(buildCreateDto({ location: CENTER }));

      const updated = await repository.update(pet.id, { location: NEAR });

      expect(updated?.location.lat).toBeCloseTo(NEAR.lat, 5);
      expect(updated?.location.lng).toBeCloseTo(NEAR.lng, 5);
    });

    it('bumps updatedAt', async () => {
      const pet = await repository.save(buildCreateDto());
      await new Promise((resolve) => setTimeout(resolve, 5));

      const updated = await repository.update(pet.id, { reward: 500 });

      expect(updated!.updatedAt.getTime()).toBeGreaterThan(pet.updatedAt.getTime());
    });

    it('returns null for an id that does not exist', async () => {
      const result = await repository.update(randomUUID(), { name: 'Ghost' });

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('transitions status and returns the updated pet', async () => {
      const pet = await repository.save(buildCreateDto({ status: 'missing' }));

      const updated = await repository.updateStatus(pet.id, 'resolved');

      expect(updated?.status).toBe('resolved');
    });

    it('returns null for an id that does not exist', async () => {
      const result = await repository.updateStatus(randomUUID(), 'paused');

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('deletes the pet and cascades to its comments and chat rooms', async () => {
      const pet = await repository.save(buildCreateDto());
      const finder = await prisma.user.create({
        data: { email: 'finder@fixture.test', password: 'irrelevant-hash', name: 'Finder' },
      });
      const comment = await prisma.comment.create({
        data: { message: 'Widziałem go', type: 'general', petId: pet.id, userId: owner.id },
      });
      const chatRoom = await prisma.chatRoom.create({
        data: { petId: pet.id, ownerId: owner.id, finderId: finder.id },
      });

      const result = await repository.deleteById(pet.id);

      expect(result).toBe('deleted');
      expect(await repository.findById(pet.id)).toBeNull();
      expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toBeNull();
      expect(await prisma.chatRoom.findUnique({ where: { id: chatRoom.id } })).toBeNull();
    });

    it('returns "not_found" for an id that does not exist, without throwing', async () => {
      const result = await repository.deleteById(randomUUID());

      expect(result).toBe('not_found');
    });
  });
});
