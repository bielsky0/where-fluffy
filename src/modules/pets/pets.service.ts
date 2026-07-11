import { CreatePetDTO } from './dto/create-pet.dto.js';
import { PetResponseDTO } from './dto/pet-response.dto.js';
import { SimilarPetResponseDTO } from './dto/similar-pet-response.dto.js';
import { UpdatePetDTO } from './dto/update-pet.dto.js';
import { IPet, PetRepository } from './interfaces/pets.interface.js';
import { mapToResponseDTO, mapToSimilarResponseDTO } from './pets.mapper.js';
import { categorizePetSpecies } from './pets.category.js';
import { PhotoService } from '../../shared/photo/photo.service.js';
import { GeocodingService } from '../../shared/geocoding/interfaces/geocoding.interface.js';
import { createAppError } from '../../shared/errors/app-error.js';
import { PetEmbeddingQueue } from '../../shared/queue/pet-embedding.queue.js';
import { logger } from '../../shared/infrastructure/logger.js';

export type PetsService = {
  reportMissingPet: (dto: CreatePetDTO) => Promise<PetResponseDTO>;
  getPetsNearby: (lat: number, lng: number, radius?: number) => Promise<PetResponseDTO[]>;
  getPetById: (id: string) => Promise<PetResponseDTO>;
  getPetsByOwner: (ownerId: string) => Promise<PetResponseDTO[]>;
  updatePet: (petId: string, requesterId: string, dto: UpdatePetDTO) => Promise<PetResponseDTO>;
  updatePetStatus: (petId: string, requesterId: string, status: IPet['status']) => Promise<PetResponseDTO>;
  deletePet: (petId: string, requesterId: string) => Promise<void>;
  getSimilarPets: (petId: string, radius?: number) => Promise<SimilarPetResponseDTO[]>;
};

// "Wyświetlamy tylko 4" — nie jest konfigurowalne przez klienta.
const SIMILAR_PETS_LIMIT = 4;
// Środek zakresu 10-20km ze specyfikacji.
const DEFAULT_SIMILAR_RADIUS_M = 15_000;

// Pola, które faktycznie wpływają na tekst embeddingu (patrz ai-worker/embed-pet-data.processor.ts
// — konkatenuje name/species/category/distinguishingMarks). `category` podąża za `species`, więc
// zmiana samego species też wymaga re-enqueue. reward/phone/email/photos/city są dla embeddingu
// nieistotne.
const EMBEDDING_RELEVANT_FIELDS = ['name', 'species', 'distinguishingMarks'] as const;

export const createPetsService = (
  petRepository: PetRepository,
  photoService: PhotoService,
  geocodingService: GeocodingService,
  petEmbeddingQueue: PetEmbeddingQueue,
): PetsService => {
  const reportMissingPet = async (dto: CreatePetDTO): Promise<PetResponseDTO> => {
    // Tutaj opcjonalnie: logika biznesowa (np. limit zgłoszeń dla darmowego konta)
    const category = categorizePetSpecies(dto.species);
    const { photoBase64s, ...rest } = dto;
    const photoUrls = await Promise.all(photoBase64s.map((base64) => photoService.store(base64)));
    const photoUrl = photoUrls[0];
    // Geocoding never throws (see geocoding.service.ts's Silent Fallback contract) — a slow or
    // unreachable Nominatim must not block/fail pet creation, it just leaves city null.
    const city = await geocodingService.reverseGeocode(dto.location.lat, dto.location.lng);
    const savedPet = await petRepository.save({ ...rest, category, photoUrl, photoUrls, city });

    // Nie może zawalić/wycofać stworzenia zgłoszenia — wiersz Pet jest już zapisany, więc 500
    // tutaj byłoby kłamstwem (zgłoszenie faktycznie się udało). Luka, jaką to zostawia (zwierzak
    // trwale bez embeddingu, jeśli akurat enqueue zawiedzie, np. Redis chwilowo nieosiągalny) jest
    // świadomie odłożona jako osobna praca "reconciliation sweep" — patrz plan.
    try {
      await petEmbeddingQueue.enqueueEmbedPetData(savedPet.id);
    } catch (err) {
      logger.error({ err, petId: savedPet.id }, '[CRITICAL_AI_ERROR] failed to enqueue embedding job');
    }

    return mapToResponseDTO(savedPet);
  };

  const getPetsNearby = async (lat: number, lng: number, radius = 5000): Promise<PetResponseDTO[]> => {
    const pets = await petRepository.findNearLocation(lat, lng, radius);
    return pets.map(mapToResponseDTO);
  };

  const getPetById = async (id: string): Promise<PetResponseDTO> => {
    const pet = await petRepository.findById(id);
    if (!pet) throw createAppError(404, 'Zgłoszenie zwierzaka nie istnieje');
    return mapToResponseDTO(pet);
  };

  const getPetsByOwner = async (ownerId: string): Promise<PetResponseDTO[]> => {
    const pets = await petRepository.findByOwnerId(ownerId);
    return pets.map(mapToResponseDTO);
  };

  const assertOwnership = async (petId: string, requesterId: string): Promise<IPet> => {
    const pet = await petRepository.findById(petId);
    if (!pet) throw createAppError(404, 'Zgłoszenie zwierzaka nie istnieje');
    if (pet.ownerId !== requesterId) {
      throw createAppError(403, 'Nie masz uprawnień do edycji tego zgłoszenia');
    }
    return pet;
  };

  const updatePet = async (petId: string, requesterId: string, dto: UpdatePetDTO): Promise<PetResponseDTO> => {
    const pet = await assertOwnership(petId, requesterId);

    // species może się zmienić przy edycji — category musi za nim podążyć (przy tworzeniu liczona
    // jest tylko raz, patrz reportMissingPet).
    const category = dto.species !== undefined ? categorizePetSpecies(dto.species) : undefined;

    // Diffing zdjęć: wpisy już obecne w pet.photoUrls są używane bez zmian (pomijają
    // photoService.store), nowe wpisy przechodzą przez store() — dziś to no-op echo (patrz
    // photo.service.ts), ale zachowuje szew pod przyszły prawdziwy upload. Kolejność, w jakiej
    // klient wysłał tablicę, staje się nową kolejnością — to właśnie zapisuje reorder zdjęć,
    // bez osobnego endpointu.
    let photoUrls: string[] | undefined;
    let photoUrl: string | undefined;
    if (dto.photoBase64s !== undefined) {
      photoUrls = await Promise.all(
        dto.photoBase64s.map((entry) => (pet.photoUrls.includes(entry) ? entry : photoService.store(entry))),
      );
      photoUrl = photoUrls[0];
    }

    const updated = await petRepository.update(petId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.species !== undefined && { species: dto.species }),
      ...(category !== undefined && { category }),
      ...(dto.reward !== undefined && { reward: dto.reward }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.distinguishingMarks !== undefined && { distinguishingMarks: dto.distinguishingMarks }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(photoUrls !== undefined && { photoUrls, photoUrl }),
    });
    if (!updated) throw createAppError(404, 'Zgłoszenie zwierzaka nie istnieje');

    const embeddingRelevantChange = EMBEDDING_RELEVANT_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== pet[field],
    );
    if (embeddingRelevantChange) {
      try {
        await petEmbeddingQueue.enqueueEmbedPetData(petId);
      } catch (err) {
        logger.error({ err, petId }, '[CRITICAL_AI_ERROR] failed to enqueue embedding job');
      }
    }

    return mapToResponseDTO(updated);
  };

  const updatePetStatus = async (
    petId: string,
    requesterId: string,
    status: IPet['status'],
  ): Promise<PetResponseDTO> => {
    await assertOwnership(petId, requesterId);
    const updated = await petRepository.updateStatus(petId, status);
    if (!updated) throw createAppError(404, 'Zgłoszenie zwierzaka nie istnieje');
    return mapToResponseDTO(updated);
  };

  const deletePet = async (petId: string, requesterId: string): Promise<void> => {
    await assertOwnership(petId, requesterId);
    await petRepository.deleteById(petId);
  };

  // "Podobne zwierzęta w okolicy": brak throw dla jakiegokolwiek przypadku "brak wyników"
  // (nieistniejący petId, zwierzak jeszcze bez embeddingu, zero trafień w promieniu) — repository
  // już gwarantuje [] dla każdego z nich (patrz pets.repository.ts's findSimilar), więc sekcja na
  // froncie po prostu się nie renderuje, bez specjalnej obsługi błędu. Prawdziwa awaria bazy
  // propaguje się jako 500 przez asyncHandler/error.middleware.ts — to jedyny "błąd" ten endpoint
  // kiedykolwiek zwraca.
  const getSimilarPets = async (petId: string, radius?: number): Promise<SimilarPetResponseDTO[]> => {
    const pets = await petRepository.findSimilar(petId, radius ?? DEFAULT_SIMILAR_RADIUS_M, SIMILAR_PETS_LIMIT);
    return pets.map(mapToSimilarResponseDTO);
  };

  return {
    reportMissingPet,
    getPetsNearby,
    getPetById,
    getPetsByOwner,
    updatePet,
    updatePetStatus,
    deletePet,
    getSimilarPets,
  };
};
