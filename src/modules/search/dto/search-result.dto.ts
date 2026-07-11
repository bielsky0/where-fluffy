import { PetResponseDTO } from '../../pets/dto/pet-response.dto.js';

export interface SearchResultDTO extends PetResponseDTO {
  // 1 - cosine_distance, 0..1, wyższa wartość = bardziej podobne.
  similarity: number;
}
