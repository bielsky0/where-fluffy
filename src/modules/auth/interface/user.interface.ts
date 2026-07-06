export interface IUser {
  id: string;
  email: string;
  password?: string; // Opcjonalne, bo często będziemy chcieli je wycinać przed przekazaniem dalej
  name: string;
  createdAt: Date;
  updatedAt: Date;
}