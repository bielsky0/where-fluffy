import { PetRepository } from '../pets/interfaces/pets.interface.js';
import { CommentResponseDTO } from './dto/comment-response.dto.js';
import { CreateCommentDTO } from './dto/create-comment.dto.js';
import { CommentsRepository } from './interfaces/comment.interface.js';
import { mapToResponseDTO } from './comments.mapper.js';

// Ten sam kształt błędu co w reszcie repo (Error + .status, patrz CLAUDE.md/shared/middleware/error.middleware.ts),
// tylko bez "as any".
type HttpError = Error & { status: number };

const createHttpError = (status: number, message: string): HttpError => {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
};

export type CommentsService = {
  addCommentToPet: (dto: CreateCommentDTO) => Promise<CommentResponseDTO>;
  getPetComments: (petId: string) => Promise<CommentResponseDTO[]>;
};

export const createCommentsService = (
  repository: CommentsRepository,
  petRepository: PetRepository,
): CommentsService => {
  const addCommentToPet = async (dto: CreateCommentDTO): Promise<CommentResponseDTO> => {
    // 1. Sprawdzenie biznesowe przez warstwę abstrakcji (kontrakt PetRepository, nie Prisma)
    const pet = await petRepository.findById(dto.petId);

    if (!pet) {
      throw createHttpError(404, 'Zgłoszenie zwierzaka nie istnieje');
    }

    // 2. Zapisanie komentarza przez dedykowane repozytorium komentarzy
    const savedComment = await repository.create(dto);
    return mapToResponseDTO(savedComment);
  };

  const getPetComments = async (petId: string): Promise<CommentResponseDTO[]> => {
    const comments = await repository.findByPetId(petId);
    return comments.map(mapToResponseDTO);
  };

  return { addCommentToPet, getPetComments };
};
