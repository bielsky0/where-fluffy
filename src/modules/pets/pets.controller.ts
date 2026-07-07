import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { PetsService } from './pets.service.js';

export type PetsController = {
  create: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  listNearby: (req: AuthenticatedRequest, res: Response) => Promise<void>;
};

export const createPetsController = (petsService: PetsService): PetsController => {
  // req.body jest już zwalidowany przez middleware validate(createPetSchema) w pets.routes.ts.
  const create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const validatedBody = req.body as Omit<CreatePetDTO, 'ownerId'>;

    // Mock użytkownika (w przyszłości pobierane z middleware autoryzacji: req.user.id)
    const fallbackOwnerId = '00000000-0000-0000-0000-000000000000';

    const createPetDto: CreatePetDTO = {
      ...validatedBody,
      ownerId: req.user?.id || fallbackOwnerId,
    };

    const result = await petsService.reportMissingPet(createPetDto);
    res.status(201).json(result);
  };

  const listNearby = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : undefined;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ status: 'error', message: 'Invalid or missing lat/lng coordinates' });
      return;
    }

    const pets = await petsService.getPetsNearby(lat, lng, radius);
    res.status(200).json(pets);
  };

  return { create, listNearby };
};
