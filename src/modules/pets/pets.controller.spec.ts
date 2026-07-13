import express, { Express, Response, NextFunction } from 'express';
import request from 'supertest';
import { createPetsService } from './pets.service.js';
import { createPetsController } from './pets.controller.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { ImageStorageProvider } from '../../shared/photo/image-storage.interface.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';
import { PetEmbeddingQueue } from '../../shared/queue/pet-embedding.queue.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { validate } from '../../shared/middleware/validate.js';
import { validateQuery } from '../../shared/middleware/validate-query.js';
import { createAdminPetSchema, updatePetSchema, updatePetStatusSchema } from './pets.schema.js';
import { similarPetsQuerySchema } from './similar-pets.schema.js';

// Ten sam wzorzec co comments.controller.spec.ts: minimalna, samodzielna apka Express z
// prawdziwym serwisem/kontrolerem zbudowanym na mockowanych zależnościach, i wstrzykniętym
// req.user zamiast prawdziwego middleware authenticate (osobna suita poza zakresem tego pliku).
const fakeAuthenticate =
  (userId: string) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.user = { id: userId, email: 'jane@example.com', name: 'Jane Doe' };
    next();
  };

const buildPet = (overrides: Partial<IPet> = {}): IPet => ({
  id: 'pet-1',
  name: 'Rex',
  species: 'dog',
  category: 'dog',
  location: { lat: 52.2297, lng: 21.0122 },
  ownerId: 'owner-1',
  status: 'missing',
  reward: 100,
  phone: '600100200',
  email: null,
  distinguishingMarks: null,
  photoUrl: null,
  photoUrls: [],
  city: null,
  sourceUrl: null,
  originalContact: null,
  isAdminAdded: false,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

const buildTestApp = (repository: PetRepository, userId = 'owner-1'): Express => {
  const imageStorageProvider: ImageStorageProvider = {
    upload: jest.fn(async (base64: string) => base64),
    remove: jest.fn(async () => undefined),
  };
  const geocodingService: GeocodingService = {
    reverseGeocode: jest.fn(async () => null),
    reverseGeocodeLabel: jest.fn(async () => null),
  };
  const petEmbeddingQueue: PetEmbeddingQueue = { enqueueEmbedPetData: jest.fn(), close: jest.fn() };
  const petsService = createPetsService(repository, imageStorageProvider, geocodingService, petEmbeddingQueue);
  const controller = createPetsController(petsService);

  const app = express();
  app.use(express.json());

  app.get('/pets/mine', fakeAuthenticate(userId), asyncHandler(controller.listMine));
  // No requireAdmin here — that authorization check is its own unit
  // (require-admin.middleware.spec.ts), this suite only verifies createAdminSeeded's own logic.
  app.post(
    '/pets/admin',
    fakeAuthenticate(userId),
    validate(createAdminPetSchema),
    asyncHandler(controller.createAdminSeeded),
  );
  app.patch('/pets/:petId', fakeAuthenticate(userId), validate(updatePetSchema), asyncHandler(controller.update));
  app.patch(
    '/pets/:petId/status',
    fakeAuthenticate(userId),
    validate(updatePetStatusSchema),
    asyncHandler(controller.updateStatus),
  );
  app.delete('/pets/:petId', fakeAuthenticate(userId), asyncHandler(controller.remove));
  app.get('/pets/:petId/similar', validateQuery(similarPetsQuerySchema), asyncHandler(controller.getSimilar));

  app.use(errorHandler);
  return app;
};

const buildMockPetRepository = (): jest.Mocked<PetRepository> => ({
  findById: jest.fn(),
  save: jest.fn(),
  findNearLocation: jest.fn(),
  updateEmbedding: jest.fn(),
  clearEmbedding: jest.fn(),
  findByOwnerId: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  deleteById: jest.fn(),
  findSimilar: jest.fn(),
});

describe('pets controller (via supertest)', () => {
  let mockRepository: jest.Mocked<PetRepository>;

  beforeEach(() => {
    mockRepository = buildMockPetRepository();
  });

  describe('POST /pets/admin', () => {
    const validAdminBody = {
      name: 'Rex',
      species: 'dog',
      status: 'missing',
      location: { lat: 52.2297, lng: 21.0122 },
      reward: 0,
      phone: '600100200',
      photoBase64s: ['data:image/png;base64,abc'],
      sourceUrl: 'https://facebook.com/groups/example/posts/123',
      originalContact: 'Jan Kowalski, 600 100 200',
    };

    it('creates a pet with isAdminAdded true, ownerId from the authenticated admin, and the source fields from the body', async () => {
      mockRepository.save.mockResolvedValue(buildPet({ isAdminAdded: true, sourceUrl: validAdminBody.sourceUrl }));
      const app = buildTestApp(mockRepository, 'admin-1');

      const response = await request(app).post('/pets/admin').send(validAdminBody);

      expect(response.status).toBe(201);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'admin-1',
          isAdminAdded: true,
          sourceUrl: validAdminBody.sourceUrl,
          originalContact: validAdminBody.originalContact,
        }),
      );
    });

    it('ignores an ownerId sent in the body — always derives it from the authenticated user', async () => {
      mockRepository.save.mockResolvedValue(buildPet({ isAdminAdded: true }));
      const app = buildTestApp(mockRepository, 'admin-1');

      await request(app).post('/pets/admin').send({ ...validAdminBody, ownerId: 'someone-else' });

      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'admin-1' }));
    });
  });

  describe('GET /pets/mine', () => {
    it('returns 200 with the requester\'s own pets', async () => {
      mockRepository.findByOwnerId.mockResolvedValue([buildPet({ id: 'pet-1' }), buildPet({ id: 'pet-2' })]);
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).get('/pets/mine');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(mockRepository.findByOwnerId).toHaveBeenCalledWith('owner-1');
    });
  });

  describe('PATCH /pets/:petId', () => {
    it('returns 200 and the updated pet for a valid body from the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      mockRepository.update.mockResolvedValue(buildPet({ name: 'Max' }));
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).patch('/pets/pet-1').send({ name: 'Max' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ name: 'Max' });
      expect(mockRepository.update).toHaveBeenCalledWith('pet-1', expect.objectContaining({ name: 'Max' }));
    });

    it('returns 403 when the requester is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const app = buildTestApp(mockRepository, 'someone-else');

      const response = await request(app).patch('/pets/pet-1').send({ name: 'Max' });

      expect(response.status).toBe(403);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the pet does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).patch('/pets/missing-id').send({ name: 'Max' });

      expect(response.status).toBe(404);
    });

    it('returns 400 and ignores a status field in the body (stripped by validate(updatePetSchema))', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      mockRepository.update.mockResolvedValue(buildPet());
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).patch('/pets/pet-1').send({ name: 'Max', status: 'resolved' });

      expect(response.status).toBe(200);
      expect(mockRepository.update).toHaveBeenCalledWith('pet-1', expect.not.objectContaining({ status: expect.anything() }));
    });
  });

  describe('PATCH /pets/:petId/status', () => {
    it('returns 200 and updates status for the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      mockRepository.updateStatus.mockResolvedValue(buildPet({ status: 'resolved' }));
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).patch('/pets/pet-1/status').send({ status: 'resolved' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('pet-1', 'resolved');
    });

    it('returns 400 for an invalid status value', async () => {
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).patch('/pets/pet-1/status').send({ status: 'not-a-real-status' });

      expect(response.status).toBe(400);
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('returns 403 when the requester is not the owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const app = buildTestApp(mockRepository, 'someone-else');

      const response = await request(app).patch('/pets/pet-1/status').send({ status: 'paused' });

      expect(response.status).toBe(403);
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /pets/:petId', () => {
    it('returns 204 and deletes the pet for its owner', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).delete('/pets/pet-1');

      expect(response.status).toBe(204);
      expect(mockRepository.deleteById).toHaveBeenCalledWith('pet-1');
    });

    it('returns 403 when the requester is not the owner, without deleting', async () => {
      mockRepository.findById.mockResolvedValue(buildPet({ ownerId: 'owner-1' }));
      const app = buildTestApp(mockRepository, 'someone-else');

      const response = await request(app).delete('/pets/pet-1');

      expect(response.status).toBe(403);
      expect(mockRepository.deleteById).not.toHaveBeenCalled();
    });

    it('returns 404 when the pet does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);
      const app = buildTestApp(mockRepository, 'owner-1');

      const response = await request(app).delete('/pets/missing-id');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /pets/:petId/similar', () => {
    it('returns 200 with the service result for a valid request', async () => {
      const similar = buildPet({ id: 'pet-2' });
      mockRepository.findSimilar.mockResolvedValue([{ ...similar, distanceMeters: 500 }]);
      const app = buildTestApp(mockRepository);

      const response = await request(app).get('/pets/pet-1/similar');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([expect.objectContaining({ id: 'pet-2', distanceMeters: 500 })]);
      expect(mockRepository.findSimilar).toHaveBeenCalledWith('pet-1', 15_000, 4, 0.8);
    });

    it('returns 200 with an empty array when nothing similar is found nearby', async () => {
      mockRepository.findSimilar.mockResolvedValue([]);
      const app = buildTestApp(mockRepository);

      const response = await request(app).get('/pets/pet-1/similar');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('passes a valid radius query param through to the service', async () => {
      mockRepository.findSimilar.mockResolvedValue([]);
      const app = buildTestApp(mockRepository);

      await request(app).get('/pets/pet-1/similar?radius=5000');

      expect(mockRepository.findSimilar).toHaveBeenCalledWith('pet-1', 5000, 4, 0.8);
    });

    it('returns 400 for an invalid radius query param', async () => {
      const app = buildTestApp(mockRepository);

      const response = await request(app).get('/pets/pet-1/similar?radius=-10');

      expect(response.status).toBe(400);
      expect(mockRepository.findSimilar).not.toHaveBeenCalled();
    });
  });
});
