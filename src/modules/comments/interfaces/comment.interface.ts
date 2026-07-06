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