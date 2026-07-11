import { CreatePetDTO } from './dto/create-pet.dto.js';
import { PetResponseDTO } from './dto/pet-response.dto.js';
import { PetRepository } from './interfaces/pets.interface.js';
import { mapToResponseDTO } from './pets.mapper.js';
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
};

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

  return { reportMissingPet, getPetsNearby, getPetById };
};
