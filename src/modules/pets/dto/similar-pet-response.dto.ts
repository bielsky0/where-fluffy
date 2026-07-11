import { PetResponseDTO } from './pet-response.dto.js';

// Osobny typ zamiast opcjonalnego pola na PetResponseDTO — GET /pets/:id i inni konsumenci
// PetResponseDTO zostają nietknięci.
export interface SimilarPetResponseDTO extends PetResponseDTO {
  distanceMeters: number;
}
