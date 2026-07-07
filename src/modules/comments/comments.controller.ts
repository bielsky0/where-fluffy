import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { CreateCommentDTO } from './dto/create-comment.dto.js';
import { CommentsService } from './comments.service.js';

export type CommentsController = {
  create: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  listForPet: (req: Request, res: Response) => Promise<void>;
};

export const createCommentsController = (commentsService: CommentsService): CommentsController => {
  // req.body jest już zwalidowany przez middleware validate(createCommentSchema) na trasie.
  const create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const rawPetId = req.params.petId;

    // Jeśli z jakiegoś powodu to tablica, weź pierwszy element. W przeciwnym wypadku weź string.
    const petId = Array.isArray(rawPetId) ? rawPetId[0] : rawPetId;

    const validatedBody = req.body as Omit<CreateCommentDTO, 'petId' | 'userId'>;

    const dto = {
      ...validatedBody,
      petId, // Brak błędu TS
      userId: req.user!.id,
    };

    const result = await commentsService.addCommentToPet(dto);
    res.status(201).json(result);
  };

  const listForPet = async (req: Request, res: Response): Promise<void> => {
    const rawPetId = req.params.petId;

    // Jeśli z jakiegoś powodu to tablica, weź pierwszy element. W przeciwnym wypadku weź string.
    const petId = Array.isArray(rawPetId) ? rawPetId[0] : rawPetId;

    const result = await commentsService.getPetComments(petId);

    res.status(200).json(result);
  };

  return { create, listForPet };
};
