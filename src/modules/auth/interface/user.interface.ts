export interface IUser {
  id: string;
  email: string | null;
  password?: string | null; // Opcjonalne, bo często będziemy chcieli je wycinać przed przekazaniem dalej
  phone: string | null;
  isGhost: boolean;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}