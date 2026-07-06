export interface IPet {
  id: string;
  name: string;
  species: string;
  latitude: number;
  longitude: number;
  ownerId: string;
  status: 'missing' | 'found';
  reward: number;
  createdAt: Date;
  updatedAt: Date;
}