import { Response } from 'express';
import { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { UpdatePetDTO } from './dto/update-pet.dto.js';
import { IPet } from './interfaces/pets.interface.js';
import { PetsService } from './pets.service.js';

export type PetsController = {
  create: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  listNearby: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  getById: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  listMine: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  update: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  updateStatus: (req: AuthenticatedRequest, res: Response) => Promise<void>;
  remove: (req: AuthenticatedRequest, res: Response) => Promise<void>;
};

const extractPetId = (req: AuthenticatedRequest): string => {
  const rawPetId = req.params.petId;
  return Array.isArray(rawPetId) ? rawPetId[0] : rawPetId;
};

export const createPetsController = (petsService: PetsService): PetsController => {
  // req.body jest już zwalidowany przez middleware validate(createPetSchema) w pets.routes.ts.
  // Trasa ma authenticate przed sobą (pets.routes.ts), więc req.user jest zawsze ustawione.
  const create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const validatedBody = req.body as Omit<CreatePetDTO, 'ownerId'>;

    const createPetDto: CreatePetDTO = {
      ...validatedBody,
      ownerId: req.user!.id,
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

  // Publiczna trasa — oglądanie szczegółów zgłoszenia nie wymaga sesji.
  const getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const petId = extractPetId(req);
    const result = await petsService.getPetById(petId);
    res.status(200).json(result);
  };

  // PRYWATNE: własne zgłoszenia zalogowanego użytkownika ("Moje zgłoszenia" — patrz
  // web/src/modules/profile/pages/ProfilePage.tsx).
  const listMine = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const result = await petsService.getPetsByOwner(req.user!.id);
    res.status(200).json(result);
  };

  // req.body jest już zwalidowany przez validate(updatePetSchema) — nigdy nie niesie `status`.
  const update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const petId = extractPetId(req);
    const result = await petsService.updatePet(petId, req.user!.id, req.body as UpdatePetDTO);
    res.status(200).json(result);
  };

  const updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const petId = extractPetId(req);
    const { status } = req.body as { status: IPet['status'] };
    const result = await petsService.updatePetStatus(petId, req.user!.id, status);
    res.status(200).json(result);
  };

  const remove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const petId = extractPetId(req);
    await petsService.deletePet(petId, req.user!.id);
    res.status(204).send();
  };

  return { create, listNearby, getById, listMine, update, updateStatus, remove };
};
