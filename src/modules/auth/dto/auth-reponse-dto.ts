export interface AuthResponseDTO {
  user: {
    id: string;
    email: string;
    name: string;
  };
  token: string;
}