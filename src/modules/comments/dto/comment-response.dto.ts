export interface CommentResponseDTO {
  id: string;
  message: string;
  type: 'sighted' | 'area_checked_empty' | 'general';
  location: {
    lat: number | null;
    lng: number | null;
  } | null;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
}