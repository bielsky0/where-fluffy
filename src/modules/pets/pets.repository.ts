import { prisma } from "../../shared/prisma.js";
import { CreatePetDTO } from "./dto/create-pet.dto.js";
import { IPet } from "./interfaces/pets.interface.js";

// Typ pomocniczy dla bazy danych (odzwierciedla to, co zwraca PostGIS po ST_X/ST_Y)
type RawPetRow = {
  id: string;
  name: string;
  species: string;
  status: string;
  reward: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
};

// Mapper: konwertuje wiersz z bazy na domenowy model IPet
const mapToDomain = (row: RawPetRow): IPet => ({
  id: row.id,
  name: row.name,
  species: row.species,
  status: row.status as 'missing' | 'found',
  reward: Number(row.reward),
  ownerId: row.ownerId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  location: { lat: row.lat, lng: row.lng },
});

export const findAll = async (): Promise<IPet[]> => {
  const pets = await prisma.$queryRaw<RawPetRow[]>`
    SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
    FROM "Pet"
  `;
  return pets.map(mapToDomain);
};

export const findById = async (id: string): Promise<IPet | null> => {
  const [pet] = await prisma.$queryRaw<RawPetRow[]>`
    SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
    FROM "Pet"
    WHERE id = ${id}::uuid
  `;
  return pet ? mapToDomain(pet) : null;
};

export const save = async (dto: CreatePetDTO): Promise<IPet> => {
  const [pet] = await prisma.$queryRaw<RawPetRow[]>`
    INSERT INTO "Pet" (id, name, species, reward, "ownerId", status, location)
    VALUES (gen_random_uuid(), ${dto.name}, ${dto.species}, ${dto.reward}, ${dto.ownerId}, 'missing',
            ST_SetSRID(ST_MakePoint(${dto.location.lng}, ${dto.location.lat}), 4326)::geography)
    RETURNING *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng;
  `;
  return mapToDomain(pet);
};

export const update = async (id: string, data: Partial<CreatePetDTO>): Promise<IPet> => {
  // Jeśli aktualizujemy też lokalizację, używamy updateRaw, inaczej standardowa Prisma
  if (data.location) {
    const [updated] = await prisma.$queryRaw<RawPetRow[]>`
      UPDATE "Pet"
      SET name = COALESCE(${data.name}, name),
          location = ST_SetSRID(ST_MakePoint(${data.location.lng}, ${data.location.lat}), 4326)::geography
      WHERE id = ${id}::uuid
      RETURNING *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng;
    `;
    return mapToDomain(updated);
  }
  
  const updatedPet = await prisma.pet.update({ where: { id }, data });
  // Tu musimy dociągnąć współrzędne, bo .update nie zwróci nam przeliczonych ST_Y/X
  return findById(id) as Promise<IPet>;
};

export const remove = async (id: string): Promise<void> => {
  await prisma.pet.delete({ where: { id } });
};

export const findNearLocation = async (lat: number, lng: number, radiusInMeters: number): Promise<IPet[]> => {
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