import { CreateCommentDTO } from '../dto/create-comment.dto.js';

export interface IComment {
  id: string;
  message: string;
  type: 'sighted' | 'area_checked_empty' | 'general';
  latitude: number | null;
  longitude: number | null;
  petId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentWithAuthor extends IComment {
  author: {
    id: string;
    name: string;
  };
}

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach)
export type CommentsRepository = {
  create: (dto: CreateCommentDTO) => Promise<CommentWithAuthor>;
  findByPetId: (petId: string) => Promise<CommentWithAuthor[]>;
};
