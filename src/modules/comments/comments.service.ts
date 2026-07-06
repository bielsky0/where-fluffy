import { findById } from "../pets/pets.repository.js";
import { create, findByPetId } from "./comments.repository.js";
import { CommentResponseDTO } from "./dto/comment-response.dto.js";
import { CreateCommentDTO } from "./dto/create-comment.dto.js";


// Generyczny mapper na DTO wyjściowe
const mapToResponseDTO = (comment: any): CommentResponseDTO => ({
  id: comment.id,
  message: comment.message,
  type: comment.type as any,
  location: comment.latitude && comment.longitude ? {
    lat: comment.latitude,
    lng: comment.longitude,
  } : null,
  author: {
    id: comment.user.id,
    name: comment.user.name,
  },
  createdAt: comment.createdAt.toISOString(),
});

export const addCommentToPet = async (dto: CreateCommentDTO): Promise<CommentResponseDTO> => {
  // 1. Sprawdzenie biznesowe przez warstwę abstrakcji (Repozytorium Pets)
  const pet = await findById(dto.petId);
  
  if (!pet) {
    const error = new Error('Zgłoszenie zwierzaka nie istnieje') as any;
    error.status = 404;
    throw error;
  }

  // 2. Zapisanie komentarza przez dedykowane repozytorium komentarzy
  const savedComment = await create(dto);
  return mapToResponseDTO(savedComment);
};

export const getPetComments = async (petId: string): Promise<CommentResponseDTO[]> => {
  const comments = await findByPetId(petId);
  return comments.map(mapToResponseDTO);
};