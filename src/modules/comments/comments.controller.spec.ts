import express, { Express, Response, NextFunction } from 'express';
import request from 'supertest';
import { createCommentsService } from './comments.service.js';
import { createCommentsController } from './comments.controller.js';
import { CommentsRepository } from './interfaces/comment.interface.js';
import { PetRepository } from '../pets/interfaces/pets.interface.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { errorHandler } from '../../shared/middleware/error.middleware.js';
import { buildComment, buildMockCommentsRepository, buildMockPetRepository, buildPet } from './comments.test-helpers.js';

// Minimalna, samodzielna apka Express — tylko trasy comments, żeby test nie zależał od
// pets/auth/chat. Serwis i kontroler są prawdziwe (createCommentsService/createCommentsController),
// zbudowane na mockowanym CommentsRepository/PetRepository, dokładnie jak w auth.controller.spec.ts.
// Prawdziwe `authenticate` middleware wymaga poprawnego JWT w cookie (własna suita poza zakresem
// tego pliku), więc tu wstrzykujemy req.user bezpośrednio — tak jak zrobiłby to `authenticate`
// po udanej weryfikacji tokenu — żeby przetestować wyłącznie ścieżkę controller → service → DTO.
const fakeAuthenticate =
  (userId: string) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.user = { id: userId, email: 'jane@example.com', name: 'Jane Doe' };
    next();
  };

const buildTestApp = (
  repository: CommentsRepository,
  petRepository: PetRepository,
  userId = 'user-1',
): Express => {
  const commentsService = createCommentsService(repository, petRepository);
  const controller = createCommentsController(commentsService);

  const app = express();
  app.use(express.json());

  app.post('/pets/:petId/comments', fakeAuthenticate(userId), asyncHandler(controller.create));
  app.get('/pets/:petId/comments', asyncHandler(controller.listForPet));

  app.use(errorHandler);
  return app;
};

describe('comments controller (via supertest)', () => {
  let mockRepository: jest.Mocked<CommentsRepository>;
  let mockPetRepository: jest.Mocked<PetRepository>;
  let app: Express;

  beforeEach(() => {
    mockRepository = buildMockCommentsRepository();
    mockPetRepository = buildMockPetRepository();
    app = buildTestApp(mockRepository, mockPetRepository);
  });

  describe('POST /pets/:petId/comments', () => {
    it('returns 201 and the created comment for a valid body', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet({ id: 'pet-1' }));
      mockRepository.create.mockResolvedValue(
        buildComment({ petId: 'pet-1', userId: 'user-1', message: 'Widziałem go koło parku' }),
      );

      const response = await request(app).post('/pets/pet-1/comments').send({
        message: 'Widziałem go koło parku',
        type: 'sighted',
        latitude: 52.2297,
        longitude: 21.0122,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        message: 'Widziałem go koło parku',
        type: 'sighted',
        location: { lat: 52.2297, lng: 21.0122 },
      });
      expect(mockPetRepository.findById).toHaveBeenCalledWith('pet-1');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ petId: 'pet-1', userId: 'user-1', message: 'Widziałem go koło parku' }),
      );
    });

    it('returns 400 with Zod validation details when type is "sighted" but coordinates are missing, without calling the service', async () => {
      const response = await request(app).post('/pets/pet-1/comments').send({
        message: 'Widziałem go',
        type: 'sighted',
      });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Validation failed');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(mockPetRepository.findById).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('returns 400 for a message shorter than the minimum length', async () => {
      const response = await request(app).post('/pets/pet-1/comments').send({
        message: 'ab',
        type: 'general',
      });

      expect(response.status).toBe(400);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the referenced pet does not exist', async () => {
      mockPetRepository.findById.mockResolvedValue(null);

      const response = await request(app).post('/pets/missing-pet/comments').send({
        message: 'Ktoś widział go tutaj',
        type: 'general',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ status: 'error', message: 'Zgłoszenie zwierzaka nie istnieje' });
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /pets/:petId/comments', () => {
    it('returns 200 and the mapped list of comments for a pet, without requiring authentication', async () => {
      mockRepository.findByPetId.mockResolvedValue([
        buildComment({ id: 'comment-1', petId: 'pet-1' }),
        buildComment({ id: 'comment-2', petId: 'pet-1' }),
      ]);

      const response = await request(app).get('/pets/pet-1/comments');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({ id: 'comment-1' });
      expect(response.body[1]).toMatchObject({ id: 'comment-2' });
      expect(mockRepository.findByPetId).toHaveBeenCalledWith('pet-1');
    });

    it('returns 200 and an empty array when the pet has no comments', async () => {
      mockRepository.findByPetId.mockResolvedValue([]);

      const response = await request(app).get('/pets/pet-1/comments');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
