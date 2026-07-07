import type { PrismaClient } from '@prisma/client';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { mapToDomain, RawPetRow } from './pets.mapper.js';

export const createPetRepository = (prisma: PrismaClient): PetRepository => {
  const findById = async (id: string): Promise<IPet | null> => {
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE id = ${id}::uuid
    `;
    return pet ? mapToDomain(pet) : null;
  };

  const save = async (dto: CreatePetDTO): Promise<IPet> => {
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      INSERT INTO "Pet" (id, name, species, reward, "ownerId", status, location)
      VALUES (gen_random_uuid(), ${dto.name}, ${dto.species}, ${dto.reward}, ${dto.ownerId}, 'missing',
              ST_SetSRID(ST_MakePoint(${dto.location.lng}, ${dto.location.lat}), 4326)::geography)
      RETURNING *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng;
    `;
    return mapToDomain(pet);
  };

  const findNearLocation = async (lat: number, lng: number, radiusInMeters: number): Promise<IPet[]> => {
    const pets = await prisma.$queryRaw<RawPetRow[]>`
      SELECT *,
             ST_Y(location::geometry) as lat,
             ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE status = 'missing'
      AND ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusInMeters})
      ORDER BY ST_Distance(location, ST_MakePoint(${lng}, ${lat})::geography);
    `;

    return pets.map(mapToDomain);
  };

  return { findById, save, findNearLocation };
};
