export interface IUser {
  id: string;
  email: string | null;
  password?: string | null; // Opcjonalne, bo często będziemy chcieli je wycinać przed przekazaniem dalej
  phone: string | null;
  isGhost: boolean;
  // OAuth (Google/Facebook) — patrz auth.repository.ts's findOrCreateOAuthUser. NULL dla kont
  // hasłowych i Ghost Account (OTP).
  provider: string | null;
  providerId: string | null;
  emailVerified: boolean;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}