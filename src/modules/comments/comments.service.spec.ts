import { createCommentsService } from './comments.service.js';
import { CommentsRepository } from './interfaces/comment.interface.js';
import { PetRepository } from '../pets/interfaces/pets.interface.js';
import {
  buildComment,
  buildCreateCommentDto,
  buildMockCommentsRepository,
  buildMockPetRepository,
  buildPet,
} from './comments.test-helpers.js';

describe('createCommentsService', () => {
  let mockRepository: jest.Mocked<CommentsRepository>;
  let mockPetRepository: jest.Mocked<PetRepository>;

  beforeEach(() => {
    mockRepository = buildMockCommentsRepository();
    mockPetRepository = buildMockPetRepository();
  });

  describe('addCommentToPet', () => {
    it('checks pet existence via PetRepository before creating a comment', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet({ id: 'pet-1' }));
      mockRepository.create.mockResolvedValue(buildComment());
      const service = createCommentsService(mockRepository, mockPetRepository);

      await service.addCommentToPet(buildCreateCommentDto({ petId: 'pet-1' }));

      expect(mockPetRepository.findById).toHaveBeenCalledWith('pet-1');
      expect(mockPetRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('passes the exact DTO through to repository.create when the pet exists', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet());
      mockRepository.create.mockResolvedValue(buildComment());
      const service = createCommentsService(mockRepository, mockPetRepository);
      const dto = buildCreateCommentDto();

      await service.addCommentToPet(dto);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
    });

    it('maps the saved comment into a CommentResponseDTO', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet());
      const savedComment = buildComment({ id: 'comment-99', latitude: 52.23, longitude: 21.05 });
      mockRepository.create.mockResolvedValue(savedComment);
      const service = createCommentsService(mockRepository, mockPetRepository);

      const result = await service.addCommentToPet(buildCreateCommentDto());

      expect(result).toEqual({
        id: 'comment-99',
        message: savedComment.message,
        type: savedComment.type,
        location: { lat: 52.23, lng: 21.05 },
        author: savedComment.author,
        createdAt: savedComment.createdAt.toISOString(),
      });
    });

    it('maps a comment with no coordinates to a null location', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet());
      mockRepository.create.mockResolvedValue(buildComment({ latitude: null, longitude: null }));
      const service = createCommentsService(mockRepository, mockPetRepository);

      const result = await service.addCommentToPet(buildCreateCommentDto());

      expect(result.location).toBeNull();
    });

    it('maps a comment at latitude 0 (equator) to a real location, not null (regression guard)', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet());
      mockRepository.create.mockResolvedValue(buildComment({ latitude: 0, longitude: 21.05 }));
      const service = createCommentsService(mockRepository, mockPetRepository);

      const result = await service.addCommentToPet(buildCreateCommentDto());

      expect(result.location).toEqual({ lat: 0, lng: 21.05 });
    });

    it('rejects with a 404 HttpError and never calls repository.create when the pet does not exist', async () => {
      mockPetRepository.findById.mockResolvedValue(null);
      const service = createCommentsService(mockRepository, mockPetRepository);

      await expect(service.addCommentToPet(buildCreateCommentDto())).rejects.toMatchObject({
        statusCode: 404,
        message: 'Zgłoszenie zwierzaka nie istnieje',
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('propagates a rejection from repository.create without swallowing it', async () => {
      mockPetRepository.findById.mockResolvedValue(buildPet());
      mockRepository.create.mockRejectedValue(new Error('DB failure'));
      const service = createCommentsService(mockRepository, mockPetRepository);

      await expect(service.addCommentToPet(buildCreateCommentDto())).rejects.toThrow('DB failure');
    });
  });

  describe('getPetComments', () => {
    it('passes petId through to repository.findByPetId and maps each result', async () => {
      const comments = [buildComment({ id: 'comment-1' }), buildComment({ id: 'comment-2' })];
      mockRepository.findByPetId.mockResolvedValue(comments);
      const service = createCommentsService(mockRepository, mockPetRepository);

      const result = await service.getPetComments('pet-1');

      expect(mockRepository.findByPetId).toHaveBeenCalledWith('pet-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('comment-1');
      expect(result[1].id).toBe('comment-2');
    });

    it('returns an empty array, not null/undefined, when the pet has no comments', async () => {
      mockRepository.findByPetId.mockResolvedValue([]);
      const service = createCommentsService(mockRepository, mockPetRepository);

      const result = await service.getPetComments('pet-1');

      expect(result).toEqual([]);
    });

    it('propagates a rejection from repository.findByPetId without swallowing it', async () => {
      mockRepository.findByPetId.mockRejectedValue(new Error('DB failure'));
      const service = createCommentsService(mockRepository, mockPetRepository);

      await expect(service.getPetComments('pet-1')).rejects.toThrow('DB failure');
    });
  });
});
