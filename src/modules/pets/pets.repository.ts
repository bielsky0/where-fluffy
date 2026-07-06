import { prisma } from "../../shared/prisma.js";
import { CreatePetDTO } from "./dto/create-pet.dto.js";
import { IPet } from "./interfaces/pets.interface.js";


// 1. Pobranie wszystkich (opcjonalne, zwraca model domenowy)
export const findAll = async (): Promise<IPet[]> => {
  const pets = await prisma.pet.findMany();
  return pets as IPet[]; // Mapowanie na nasz wewnętrzny interfejs
};

// 2. Pobranie po ID
export const findById = async (id: string): Promise<IPet | null> => {
  const pet = await prisma.pet.findUnique({ where: { id } });
  if (!pet) return null;
  return pet as IPet;
};

// 3. Zapisanie nowego zwierzaka (Zastępuje surowy SQL z poprzedniego kroku)
export const save = async (dto: CreatePetDTO): Promise<IPet> => {
  const pet = await prisma.pet.create({
    data: {
      name: dto.name,
      species: dto.species,
      latitude: dto.latitude,
      longitude: dto.longitude,
      reward: dto.reward,
      ownerId: dto.ownerId,
      status: 'missing', // Domyślny status dla nowego zgłoszenia
    },
  });
  return pet as IPet;
};

// 4. Aktualizacja danych zwierzaka
export const update = async (id: string, data: Partial<CreatePetDTO>): Promise<IPet> => {
  const updatedPet = await prisma.pet.update({
    where: { id },
    data,
  });
  return updatedPet as IPet;
};

// 5. Usunięcie wpisu
export const remove = async (id: string): Promise<void> => {
  await prisma.pet.delete({ where: { id } });
};

// 6. KLUCZOWE DLA "WHERE'S FLUFFY": Wyszukiwanie w pobliżu lokalizacji (Wzór Haversine'a)
// Szuka zwierzaków w promieniu X kilometrów przy użyciu czystego SQL w Prismie
export const findNearLocation = async (
  lat: number,
  lng: number,
  radiusInKm: number = 5
): Promise<IPet[]> => {
  // Promień Ziemi w kilometrach = 6371
  const pets = await prisma.$queryRaw<IPet[]>`
    SELECT id, name, species, latitude, longitude, reward, "ownerId", status, "createdAt", "updatedAt",
      (6371 * acos(
        cos(radians(${lat})) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians(${lng})) + 
        sin(radians(${lat})) * sin(radians(latitude))
      )) AS distance
    FROM "Pet"
    WHERE status = 'missing'
    HAVING distance < ${radiusInKm}
    ORDER BY distance;
  `;

  return pets;
};