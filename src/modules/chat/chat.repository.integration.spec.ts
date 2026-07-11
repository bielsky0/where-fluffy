import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { PrismaClient, User, Pet } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createChatRepository } from './chat.repository.js';
import { ChatRepository } from './interface/chat.interface.js';

jest.setTimeout(120_000);

const SRC_ROOT = path.resolve(__dirname, '../../');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createChatRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: ChatRepository;
  let owner: User;
  let finder: User;
  let pet: Pet;

  beforeAll(async () => {
    // "where-fluffy/postgres-ai:16" (infra/db/Dockerfile) — postgis/postgis:16-3.4 plus pgvector.
    // Required here even though this file never touches Pet.embedding: `db push` diffs/creates
    // the *entire* schema.prisma, including Pet's `embedding vector(768)` column, so every
    // integration test's Postgres needs pgvector available, not just pets/search's.
    container = await new PostgreSqlContainer('where-fluffy/postgres-ai:16')
      .withDatabase('fluffy_chat_test')
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
    repository = createChatRepository(prisma);
  });

  beforeEach(async () => {
    // Świeży owner/finder/pet przed każdym testem — Pet.location zostaje puste (kolumna
    // Unsupported("geography") jest opcjonalna w schema.prisma), czatowi jest to obojętne.
    owner = await prisma.user.create({ data: { email: `owner-${randomUUID()}@example.com`, password: 'x', name: 'Owner' } });
    finder = await prisma.user.create({ data: { email: `finder-${randomUUID()}@example.com`, password: 'x', name: 'Finder' } });
    pet = await prisma.pet.create({ data: { name: 'Rex', species: 'dog', status: 'missing', ownerId: owner.id } });
  });

  afterEach(async () => {
    await prisma.message.deleteMany();
    await prisma.chatRoom.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  describe('createChatRoom / findChatRoomByKey', () => {
    it('creates a room and finds it again by the same petId/ownerId/finderId key', async () => {
      const created = await repository.createChatRoom(pet.id, owner.id, finder.id);

      expect(created.id).toEqual(expect.any(String));
      expect(created.petId).toBe(pet.id);
      expect(created.ownerId).toBe(owner.id);
      expect(created.finderId).toBe(finder.id);
      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findChatRoomByKey(pet.id, owner.id, finder.id);
      expect(found).toEqual(created);
    });

    it('returns null for a key that does not match any existing room', async () => {
      const found = await repository.findChatRoomByKey(pet.id, owner.id, finder.id);
      expect(found).toBeNull();
    });
  });

  describe('createMessage / getRoomMessages', () => {
    it('persists a message with sender info and returns it via getRoomMessages', async () => {
      const room = await repository.createChatRoom(pet.id, owner.id, finder.id);

      const created = await repository.createMessage(room.id, finder.id, 'Hello!');
      expect(created.chatRoomId).toBe(room.id);
      expect(created.text).toBe('Hello!');
      expect(created.sender).toEqual({ id: finder.id, name: 'Finder' });

      const messages = await repository.getRoomMessages(room.id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(created);
    });

    it('returns messages ordered oldest first', async () => {
      const room = await repository.createChatRoom(pet.id, owner.id, finder.id);
      const first = await repository.createMessage(room.id, owner.id, 'first');
      await wait(10);
      const second = await repository.createMessage(room.id, finder.id, 'second');

      const messages = await repository.getRoomMessages(room.id);

      expect(messages.map((m) => m.id)).toEqual([first.id, second.id]);
    });
  });

  describe('getUserRooms', () => {
    it('returns rooms where the user is either owner or finder, with pet and interlocutor relations', async () => {
      const room = await repository.createChatRoom(pet.id, owner.id, finder.id);
      await repository.createMessage(room.id, finder.id, 'latest message');

      const ownerRooms = await repository.getUserRooms(owner.id);
      const finderRooms = await repository.getUserRooms(finder.id);

      expect(ownerRooms).toHaveLength(1);
      expect(ownerRooms[0].id).toBe(room.id);
      expect(ownerRooms[0].pet).toEqual({ id: pet.id, name: 'Rex', status: 'missing' });
      expect(ownerRooms[0].owner).toEqual({ id: owner.id, name: 'Owner' });
      expect(ownerRooms[0].finder).toEqual({ id: finder.id, name: 'Finder' });
      expect(ownerRooms[0].messages[0].text).toBe('latest message');

      expect(finderRooms).toHaveLength(1);
      expect(finderRooms[0].id).toBe(room.id);
    });

    it('only includes the single most recent message per room', async () => {
      const room = await repository.createChatRoom(pet.id, owner.id, finder.id);
      await repository.createMessage(room.id, owner.id, 'older');
      await wait(10);
      await repository.createMessage(room.id, finder.id, 'newer');

      const rooms = await repository.getUserRooms(owner.id);

      expect(rooms[0].messages).toHaveLength(1);
      expect(rooms[0].messages[0].text).toBe('newer');
    });

    it('returns an empty array for a user with no rooms', async () => {
      const uninvolvedUser = await prisma.user.create({
        data: { email: `bystander-${randomUUID()}@example.com`, password: 'x', name: 'Bystander' },
      });

      const rooms = await repository.getUserRooms(uninvolvedUser.id);

      expect(rooms).toEqual([]);
    });
  });

  describe('findPetById', () => {
    it('returns only the id and ownerId for an existing pet', async () => {
      const found = await repository.findPetById(pet.id);

      expect(found).toEqual({ id: pet.id, ownerId: owner.id });
    });

    it('returns null for a pet that does not exist', async () => {
      const found = await repository.findPetById(randomUUID());

      expect(found).toBeNull();
    });
  });
});
