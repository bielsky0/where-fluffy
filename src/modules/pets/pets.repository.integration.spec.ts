import path from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient, User } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPetRepository } from './pets.repository.js';
import { PetRepository } from './interfaces/pets.interface.js';
import { CreatePetDTO } from './dto/create-pet.dto.js';

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
    container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
      .withDatabase('fluffy_test')
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

  const buildCreateDto = (overrides: Partial<CreatePetDTO> = {}): CreatePetDTO => ({
    name: 'Rex',
    species: 'dog',
    location: CENTER,
    reward: 100,
    ownerId: owner.id,
    ...overrides,
  });

  // save() zawsze wymusza status 'missing' — do zasiania rekordu 'found' (potrzebnego przy
  // testowaniu filtra statusu w findNearLocation) trzeba obejść repozytorium i wstawić wiersz
  // bezpośrednio.
  const insertFoundPetDirectly = async (location: { lat: number; lng: number }) => {
    await prisma.$executeRaw`
      INSERT INTO "Pet" (id, name, species, reward, "ownerId", status, location, "updatedAt")
      VALUES (${randomUUID()}, 'Already Found', 'cat', 0, ${owner.id}, 'found',
              ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography, now())
    `;
  };

  describe('save', () => {
    it('inserts a pet with status forced to "missing" and returns the persisted row', async () => {
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
  });
});
