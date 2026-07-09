import { CreatePetDTO } from './dto/create-pet.dto.js';
import { PetResponseDTO } from './dto/pet-response.dto.js';
import { PetRepository } from './interfaces/pets.interface.js';
import { mapToResponseDTO } from './pets.mapper.js';
import { categorizePetSpecies } from './pets.category.js';

export type PetsService = {
  reportMissingPet: (dto: CreatePetDTO) => Promise<PetResponseDTO>;
  getPetsNearby: (lat: number, lng: number, radius?: number) => Promise<PetResponseDTO[]>;
};

export const createPetsService = (petRepository: PetRepository): PetsService => {
  const reportMissingPet = async (dto: CreatePetDTO): Promise<PetResponseDTO> => {
    // Tutaj opcjonalnie: logika biznesowa (np. limit zgłoszeń dla darmowego konta)
    const category = categorizePetSpecies(dto.species);
    const savedPet = await petRepository.save({ ...dto, category });
    return mapToResponseDTO(savedPet);
  };

  const getPetsNearby = async (lat: number, lng: number, radius = 5000): Promise<PetResponseDTO[]> => {
    const pets = await petRepository.findNearLocation(lat, lng, radius);
    return pets.map(mapToResponseDTO);
  };

  return { reportMissingPet, getPetsNearby };
};
