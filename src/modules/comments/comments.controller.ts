import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { createCommentSchema } from './comments.schema.js';
import { CommentsService } from './comments.service.js';

export type CommentsController = {
  create: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  listForPet: (req: Request, res: Response) => Promise<void>;
};

export const createCommentsController = (commentsService: CommentsService): CommentsController => {
  const create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const rawPetId = req.params.petId;

    // Jeśli z jakiegoś powodu to tablica, weź pierwszy element. W przeciwnym wypadku weź string.
    const petId = Array.isArray(rawPetId) ? rawPetId[0] : rawPetId;

    // W tym miejscu TypeScript jest w 100% pewny, że 'petId' to czysty 'string'
    const validatedBody = createCommentSchema.parse(req.body);

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
