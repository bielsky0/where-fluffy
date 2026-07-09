export interface AuthResponseDTO {
  user: {
    id: string;
    email: string | null;
    name: string;
  };
  token: string;
}