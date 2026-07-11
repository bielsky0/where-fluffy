import { Prisma, type PrismaClient } from '@prisma/client';
import { CreatePetRecordDTO } from './dto/create-pet.dto.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { mapToDomain, RawPetRow } from './pets.mapper.js';

export const createPetRepository = (prisma: PrismaClient): PetRepository => {
  // Kolumny wybierane jawnie (bez "*"/"RETURNING *") — surowa kolumna "location" jest typu
  // Unsupported("geography") i Prisma nie potrafi jej zdeserializować z $queryRaw; musimy zwracać
  // wyłącznie przeliczone ST_Y/ST_X. "id" porównujemy bez rzutowania na ::uuid, bo kolumna w bazie
  // ma typ TEXT (Prisma String), a Postgres nie ma operatora text = uuid.
  const findById = async (id: string): Promise<IPet | null> => {
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      SELECT id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
             "photoUrls", city, "ownerId", "createdAt", "updatedAt",
             ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE id = ${id}
    `;
    return pet ? mapToDomain(pet) : null;
  };

  const save = async (dto: CreatePetRecordDTO): Promise<IPet> => {
    // "updatedAt" jest w bazie kolumną NOT NULL bez wartości domyślnej — @updatedAt w
    // schema.prisma to funkcja klienta Prisma, nie DEFAULT na poziomie bazy, więc raw INSERT
    // musi ją ustawić jawnie (now()). `status` przychodzi z DTO (lost/found), nie jest już
    // zahardkodowany — patrz CreatePetDTO.status / addListingWizard StepFork.
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      INSERT INTO "Pet" (
        id, name, species, category, reward, phone, email, "distinguishingMarks", "photoUrl",
        "photoUrls", city, "ownerId", status, location, "updatedAt"
      )
      VALUES (
        gen_random_uuid(), ${dto.name ?? null}, ${dto.species}, ${dto.category}, ${dto.reward},
        ${dto.phone ?? null}, ${dto.email ?? null}, ${dto.distinguishingMarks ?? null}, ${dto.photoUrl ?? null},
        ${dto.photoUrls}, ${dto.city}, ${dto.ownerId}, ${dto.status},
        ST_SetSRID(ST_MakePoint(${dto.location.lng}, ${dto.location.lat}), 4326)::geography, now()
      )
      RETURNING id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
                "photoUrls", city, "ownerId", "createdAt", "updatedAt",
                ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng;
    `;
    return mapToDomain(pet);
  };

  const findNearLocation: PetRepository['findNearLocation'] = async (lat, lng, radiusInMeters, options = {}) => {
    const categoryFragment = options.category ? Prisma.sql`AND category = ${options.category}` : Prisma.empty;
    const limitFragment = options.limit !== undefined ? Prisma.sql`LIMIT ${options.limit}` : Prisma.empty;

    const pets = await prisma.$queryRaw<RawPetRow[]>`
      SELECT id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
             "photoUrls", city, "ownerId", "createdAt", "updatedAt",
             ST_Y(location::geometry) as lat,
             ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE status = 'missing'
      AND ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusInMeters})
      ${categoryFragment}
      ORDER BY ST_Distance(location, ST_MakePoint(${lng}, ${lat})::geography)
      ${limitFragment};
    `;

    return pets.map(mapToDomain);
  };

  // pgvector przyjmuje wektory na wejściu jako tekstowy literał "[v1,v2,...]" rzutowany po
  // stronie serwera na ::vector — ta sama technika co ST_MakePoint(${lng}, ${lat}) powyżej.
  // Zawsze UPDATE, nigdy INSERT — spełnia wymóg idempotentności (dwie szybkie edycje tego
  // samego zwierzaka => dwa zadania w kolejce => dwa UPDATE-y => wygrywa ostatni zapis, bez
  // duplikatów). Celowo nie dotyka "updatedAt" — to zapis systemowy w tle, nie edycja
  // użytkownika, więc GET /pets/:id nie pokaże mylącego "ostatnio zaktualizowano" wywołanego
  // wyłącznie przez backfill embeddingu.
  const updateEmbedding: PetRepository['updateEmbedding'] = async (petId, vector) => {
    const vectorLiteral = `[${vector.join(',')}]`;
    const affected = await prisma.$executeRaw`
      UPDATE "Pet" SET embedding = ${vectorLiteral}::vector WHERE id = ${petId}
    `;
    return affected > 0 ? 'updated' : 'not_found';
  };

  return { findById, save, findNearLocation, updateEmbedding };
};
