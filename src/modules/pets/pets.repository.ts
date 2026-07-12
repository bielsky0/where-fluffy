import { Prisma, type PrismaClient } from '@prisma/client';
import { CreatePetRecordDTO } from './dto/create-pet.dto.js';
import { IPet, PetRepository, PetUpdatePatch } from './interfaces/pets.interface.js';
import { mapToDomain, mapToSimilarDomain, RawPetRow, RawSimilarPetRow } from './pets.mapper.js';

// Ta sama jawna lista kolumn co findById/save/findNearLocation — nigdy SELECT */RETURNING * na
// tabeli z kolumną geography (patrz CLAUDE.md's PostGIS gotcha #1).
const RETURNING_COLUMNS = Prisma.sql`
  id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
  "photoUrls", city, "sourceUrl", "originalContact", "isAdminAdded", "ownerId", "createdAt", "updatedAt",
  ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
`;

export const createPetRepository = (prisma: PrismaClient): PetRepository => {
  // Kolumny wybierane jawnie (bez "*"/"RETURNING *") — surowa kolumna "location" jest typu
  // Unsupported("geography") i Prisma nie potrafi jej zdeserializować z $queryRaw; musimy zwracać
  // wyłącznie przeliczone ST_Y/ST_X. "id" porównujemy bez rzutowania na ::uuid, bo kolumna w bazie
  // ma typ TEXT (Prisma String), a Postgres nie ma operatora text = uuid.
  const findById = async (id: string): Promise<IPet | null> => {
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      SELECT id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
             "photoUrls", city, "sourceUrl", "originalContact", "isAdminAdded", "ownerId", "createdAt", "updatedAt",
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
        "photoUrls", city, "sourceUrl", "originalContact", "isAdminAdded", "ownerId", status, location, "updatedAt"
      )
      VALUES (
        gen_random_uuid(), ${dto.name ?? null}, ${dto.species}, ${dto.category}, ${dto.reward},
        ${dto.phone ?? null}, ${dto.email ?? null}, ${dto.distinguishingMarks ?? null}, ${dto.photoUrl ?? null},
        ${dto.photoUrls}, ${dto.city}, ${dto.sourceUrl ?? null}, ${dto.originalContact ?? null},
        ${dto.isAdminAdded ?? false}, ${dto.ownerId}, ${dto.status},
        ST_SetSRID(ST_MakePoint(${dto.location.lng}, ${dto.location.lat}), 4326)::geography, now()
      )
      RETURNING id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
                "photoUrls", city, "sourceUrl", "originalContact", "isAdminAdded", "ownerId", "createdAt", "updatedAt",
                ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng;
    `;
    return mapToDomain(pet);
  };

  const findNearLocation: PetRepository['findNearLocation'] = async (lat, lng, radiusInMeters, options = {}) => {
    const categoryFragment = options.category ? Prisma.sql`AND category = ${options.category}` : Prisma.empty;
    const limitFragment = options.limit !== undefined ? Prisma.sql`LIMIT ${options.limit}` : Prisma.empty;

    const pets = await prisma.$queryRaw<RawPetRow[]>`
      SELECT id, name, species, status, category, reward, phone, email, "distinguishingMarks", "photoUrl",
             "photoUrls", city, "sourceUrl", "originalContact", "isAdminAdded", "ownerId", "createdAt", "updatedAt",
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

  const findByOwnerId = async (ownerId: string): Promise<IPet[]> => {
    const pets = await prisma.$queryRaw<RawPetRow[]>`
      SELECT ${RETURNING_COLUMNS}
      FROM "Pet"
      WHERE "ownerId" = ${ownerId}
      ORDER BY "createdAt" DESC
    `;
    return pets.map(mapToDomain);
  };

  // Buduje UPDATE tylko dla kluczy faktycznie obecnych w `patch` — reszta kolumn zostaje
  // nietknięta. `location` idzie przez ten sam ST_SetSRID(ST_MakePoint(...)) co w save() powyżej.
  // Zwraca null zamiast rzucać, gdy `petId` nie istnieje (0 dotkniętych wierszy).
  const update = async (petId: string, patch: PetUpdatePatch): Promise<IPet | null> => {
    const fragments: Prisma.Sql[] = [];
    if (patch.name !== undefined) fragments.push(Prisma.sql`name = ${patch.name}`);
    if (patch.species !== undefined) fragments.push(Prisma.sql`species = ${patch.species}`);
    if (patch.category !== undefined) fragments.push(Prisma.sql`category = ${patch.category}`);
    if (patch.reward !== undefined) fragments.push(Prisma.sql`reward = ${patch.reward}`);
    if (patch.phone !== undefined) fragments.push(Prisma.sql`phone = ${patch.phone}`);
    if (patch.email !== undefined) fragments.push(Prisma.sql`email = ${patch.email}`);
    if (patch.distinguishingMarks !== undefined) {
      fragments.push(Prisma.sql`"distinguishingMarks" = ${patch.distinguishingMarks}`);
    }
    if (patch.photoUrl !== undefined) fragments.push(Prisma.sql`"photoUrl" = ${patch.photoUrl}`);
    if (patch.photoUrls !== undefined) fragments.push(Prisma.sql`"photoUrls" = ${patch.photoUrls}`);
    if (patch.city !== undefined) fragments.push(Prisma.sql`city = ${patch.city}`);
    if (patch.location !== undefined) {
      fragments.push(
        Prisma.sql`location = ST_SetSRID(ST_MakePoint(${patch.location.lng}, ${patch.location.lat}), 4326)::geography`,
      );
    }
    fragments.push(Prisma.sql`"updatedAt" = now()`);

    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      UPDATE "Pet" SET ${Prisma.join(fragments, ', ')}
      WHERE id = ${petId}
      RETURNING ${RETURNING_COLUMNS};
    `;
    return pet ? mapToDomain(pet) : null;
  };

  // Węższy, jednokolumnowy odpowiednik update() — celowo osobno, ta sama logika "dyskretnych akcji"
  // co przy podziale schematów (patrz pets.schema.ts).
  const updateStatus = async (petId: string, status: IPet['status']): Promise<IPet | null> => {
    const [pet] = await prisma.$queryRaw<RawPetRow[]>`
      UPDATE "Pet" SET status = ${status}, "updatedAt" = now()
      WHERE id = ${petId}
      RETURNING ${RETURNING_COLUMNS};
    `;
    return pet ? mapToDomain(pet) : null;
  };

  // "Podobne zwierzęta w okolicy": CTE `source` czyta location+embedding zwierzaka o id=petId, a
  // główne zapytanie łączy podobieństwo kosinusowe (embedding <=> source.embedding, wykorzystuje
  // istniejący indeks HNSW Pet_embedding_idx) z filtrem geograficznym (ST_DWithin, wykorzystuje
  // istniejący indeks GiST na location) wokół tego samego punktu źródłowego. CROSS JOIN source
  // sprawia, że każdy przypadek brzegowy zwraca po prostu 0 wierszy zamiast wymagać osobnej
  // gałęzi w JS: petId nie istnieje -> source ma 0 wierszy -> CROSS JOIN daje 0; source.embedding
  // lub source.location jest NULL (zwierzak jeszcze nieprzetworzony przez ai-worker albo,
  // teoretycznie, bez lokalizacji) -> odfiltrowane explicit warunkami; brak kandydatów w
  // promieniu/statusie -> naturalne 0 wierszy.
  const findSimilar: PetRepository['findSimilar'] = async (petId, radiusInMeters, limit) => {
    const rows = await prisma.$queryRaw<RawSimilarPetRow[]>`
      WITH source AS (
        SELECT location, embedding FROM "Pet" WHERE id = ${petId}
      )
      SELECT p.id, p.name, p.species, p.status, p.category, p.reward, p.phone, p.email,
             p."distinguishingMarks", p."photoUrl", p."photoUrls", p.city,
             p."sourceUrl", p."originalContact", p."isAdminAdded", p."ownerId",
             p."createdAt", p."updatedAt",
             ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lng,
             ST_Distance(p.location, source.location) as "distanceMeters"
      FROM "Pet" p
      CROSS JOIN source
      WHERE p.id != ${petId}
        AND p.status = 'missing'
        AND p.embedding IS NOT NULL
        AND source.embedding IS NOT NULL
        AND source.location IS NOT NULL
        AND ST_DWithin(p.location, source.location, ${radiusInMeters})
      ORDER BY p.embedding <=> source.embedding
      LIMIT ${limit};
    `;
    return rows.map(mapToSimilarDomain);
  };

  // Comment/ChatRoom mają onDelete: Cascade na relacji do Pet (schema.prisma) — kasując wiersz
  // Pet, baza sama usuwa powiązane komentarze/pokoje czatu/wiadomości. `embedding` to kolumna na
  // tym samym wierszu, więc znika razem z nim — bez osobnego czyszczenia wektorów.
  const deleteById = async (petId: string): Promise<'deleted' | 'not_found'> => {
    const affected = await prisma.$executeRaw`DELETE FROM "Pet" WHERE id = ${petId}`;
    return affected > 0 ? 'deleted' : 'not_found';
  };

  return {
    findById,
    save,
    findNearLocation,
    updateEmbedding,
    findByOwnerId,
    update,
    updateStatus,
    deleteById,
    findSimilar,
  };
};
