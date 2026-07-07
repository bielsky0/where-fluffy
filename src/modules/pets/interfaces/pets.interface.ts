export interface IPet {
  id: string;
  name: string;
  species: string;
  // Ujednolicamy strukturę lokalizacji
  location: {
    lat: number;
    lng: number;
  };
  ownerId: string;
  status: 'missing' | 'found';
  reward: number;
  createdAt: Date;
  updatedAt: Date;
}