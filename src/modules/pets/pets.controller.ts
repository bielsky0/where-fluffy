import { Request, Response } from 'express';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { createPetSchema } from './pets.schema.js';
import { reportMissingPet, getPetsNearby } from './pets.service.js';

export const create = async (req: Request, res: Response) => {
  // 1. Walidacja danych wejściowych z body
  const validatedBody = createPetSchema.parse(req.body);

  // Mock użytkownika (w przyszłości pobierane z middleware autoryzacji: req.user.id)
  const fallbackOwnerId = '00000000-0000-0000-0000-000000000000';

  // 2. Przygotowanie DTO dla serwisu
  const createPetDto: CreatePetDTO = {
    ...validatedBody,
    ownerId: (req as any).user?.id || fallbackOwnerId,
  };

  // 3. Wywołanie logiki biznesowej
  const result = await reportMissingPet(createPetDto);

  // 4. Odpowiedź HTTP
  res.status(201).json(result);
};

export const listNearby = async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : undefined;

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ status: 'error', message: 'Invalid or missing lat/lng coordinates' });
    return;
  }

  const pets = await getPetsNearby(lat, lng, radius);
  res.status(200).json(pets);
};