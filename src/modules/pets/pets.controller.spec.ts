import express, { Express, Response, NextFunction } from 'express';
import request from 'supertest';
import { createPetsService } from './pets.service.js';
import { createPetsController } from './pets.controller.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { PhotoService } from '../../shared/photo/photo.service.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';
import { PetEmbeddingQueue } from '../../shared/queue/pet-embedding.queue.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { validate } from '../../shared/middleware/validate.js';
import { updatePetSchema, updatePetStatusSchema } from './pets.schema.js';

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
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

const buildTestApp = (repository: PetRepository, userId = 'owner-1'): Express => {
  const photoService: PhotoService = { store: jest.fn(async (base64: string) => base64) };
  const geocodingService: GeocodingService = { reverseGeocode: jest.fn(async () => null) };
  const petEmbeddingQueue: PetEmbeddingQueue = { enqueueEmbedPetData: jest.fn(), close: jest.fn() };
  const petsService = createPetsService(repository, photoService, geocodingService, petEmbeddingQueue);
  const controller = createPetsController(petsService);

  const app = express();
  app.use(express.json());

  app.get('/pets/mine', fakeAuthenticate(userId), asyncHandler(controller.listMine));
  app.patch('/pets/:petId', fakeAuthenticate(userId), validate(updatePetSchema), asyncHandler(controller.update));
  app.patch(
    '/pets/:petId/status',
    fakeAuthenticate(userId),
    validate(updatePetStatusSchema),
    asyncHandler(controller.updateStatus),
  );
  app.delete('/pets/:petId', fakeAuthenticate(userId), asyncHandler(controller.remove));

  app.use(errorHandler);
  return app;
};

const buildMockPetRepository = (): jest.Mocked<PetRepository> => ({
  findById: jest.fn(),
  save: jest.fn(),
  findNearLocation: jest.fn(),
  updateEmbedding: jest.fn(),
  findByOwnerId: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  deleteById: jest.fn(),
});

describe('pets controller (via supertest)', () => {
  let mockRepository: jest.Mocked<PetRepository>;

  beforeEach(() => {
    mockRepository = buildMockPetRepository();
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
});
