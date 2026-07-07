import { CommentResponseDTO } from './dto/comment-response.dto.js';
import { CommentWithAuthor } from './interfaces/comment.interface.js';

// Typ pomocniczy dla bazy danych (odzwierciedla to, co zwraca PostGIS po ST_X/ST_Y + JOIN z User)
export type RawCommentRow = {
  id: string;
  message: string;
  type: string;
  petId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  lat: number | null;
  lng: number | null;
  authorName: string;
};

// Mapper: konwertuje wiersz z bazy na domenowy model CommentWithAuthor
export const mapToDomain = (row: RawCommentRow): CommentWithAuthor => ({
  id: row.id,
  message: row.message,
  type: row.type as 'sighted' | 'area_checked_empty' | 'general',
  latitude: row.lat,
  longitude: row.lng,
  petId: row.petId,
  userId: row.userId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  author: {
    id: row.userId,
    name: row.authorName,
  },
});

// Mapper: transformuje model domenowy na DTO wyjściowe. Sprawdzamy jawnie "!== null" (nie
// truthy-check) — komentarz na równiku (latitude 0) jest poprawną współrzędną, nie brakiem lokalizacji.
export const mapToResponseDTO = (comment: CommentWithAuthor): CommentResponseDTO => ({
  id: comment.id,
  message: comment.message,
  type: comment.type,
  location: comment.latitude !== null && comment.longitude !== null
    ? { lat: comment.latitude, lng: comment.longitude }
    : null,
  author: {
    id: comment.author.id,
    name: comment.author.name,
  },
  createdAt: comment.createdAt.toISOString(),
});
