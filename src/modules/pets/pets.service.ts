import { CreatePetDTO } from "./dto/create-pet.dto.js";
import { PetResponseDTO } from "./dto/pet-response.dto.js";
import { IPet } from "./interfaces/pets.interface.js";
import { save, findNearLocation } from "./pets.repository.js";



// Funkcja pomocnicza (Mapper) do transformacji modelu domenowego na DTO wyjściowe
const mapToResponseDTO = (pet: IPet): PetResponseDTO => ({
  id: pet.id,
  name: pet.name,
  species: pet.species,
  status: pet.status,
  reward: Number(pet.reward),
  location: {
    lat: Number(pet.location.lat),
    lng: Number(pet.location.lng),
  },
  createdAt: pet.createdAt.toISOString(),
});

export const reportMissingPet = async (dto: CreatePetDTO): Promise<PetResponseDTO> => {
  // Tutaj opcjonalnie: logika biznesowa (np. limit zgłoszeń dla darmowego konta)
  
  const savedPet = await save(dto);
  return mapToResponseDTO(savedPet);
};

export const getPetsNearby = async (lat: number, lng: number, radius = 5000): Promise<PetResponseDTO[]> => {
  const pets = await findNearLocation(lat, lng, radius);
  return pets.map(mapToResponseDTO);
};