// Mirrors src/modules/auth/dto/*.dto.ts and interface/user.interface.ts (password field
// excluded — the backend never sends it back). Duplicated here for the same shared-types/
// placeholder reason as pets/chat.types.ts.
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface LoginResponse {
  user: User;
}
