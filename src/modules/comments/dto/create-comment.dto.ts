export interface CreateCommentDTO {
  message: string;
  type: 'sighted' | 'area_checked_empty' | 'general';
  latitude?: number;
  longitude?: number;
  petId: string;
  userId: string;
}