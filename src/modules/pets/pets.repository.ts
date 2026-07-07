import type { PrismaClient } from '@prisma/client';
import { CreatePetDTO } from './dto/create-pet.dto.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { mapToDomain, RawPetRow } from './pets.mapper.js';

export const createPetRepository = (prisma: PrismaClient): PetRepository => {
  // Kolumny wybierane jawnie (bez "*"/"RETURNING *") — surowa kolumna "location" jest typu
  // Unsupported("geography") i Prisma nie potrafi jej zdeserializować z $queryRaw; musimy zwracać
  // wyłącznie przeliczone ST_Y/ST_X. "id" porównujemy bez rzutowania na ::uuid, bo kolumna w bazie
  // ma typ TEXT (Prisma String), a Postgres nie ma operatora text = uuid.
  const findById = async (id: string): Promise<IPet | null> => {
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      SELECT id, name, species, status, reward, "ownerId", "createdAt", "updatedAt",
             ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE id = ${id}
    `;
    return pet ? mapToDomain(pet) : null;
  };

  const save = async (dto: CreatePetDTO): Promise<IPet> => {
    // "updatedAt" jest w bazie kolumną NOT NULL bez wartości domyślnej — @updatedAt w
    // schema.prisma to funkcja klienta Prisma, nie DEFAULT na poziomie bazy, więc raw INSERT
    // musi ją ustawić jawnie (now()).
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      INSERT INTO "Pet" (id, name, species, reward, "ownerId", status, location, "updatedAt")
      VALUES (gen_random_uuid(), ${dto.name}, ${dto.species}, ${dto.reward}, ${dto.ownerId}, 'missing',
              ST_SetSRID(ST_MakePoint(${dto.location.lng}, ${dto.location.lat}), 4326)::geography, now())
      RETURNING id, name, species, status, reward, "ownerId", "createdAt", "updatedAt",
                ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng;
    `;
    return mapToDomain(pet);
  };

  const findNearLocation = async (lat: number, lng: number, radiusInMeters: number): Promise<IPet[]> => {
    const pets = await prisma.$queryRaw<RawPetRow[]>`
      SELECT id, name, species, status, reward, "ownerId", "createdAt", "updatedAt",
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
