// Mirrors src/modules/auth/dto/*.dto.ts and interface/user.interface.ts (password field
// excluded — the backend never sends it back). Duplicated here for the same shared-types/
// placeholder reason as pets/chat.types.ts. `email` is nullable — a Ghost Account created via
// phone-only OTP verification (see useRequestOtp/useVerifyOtp) has none.
export interface User {
  id: string;
  email: string | null;
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

// Ghost Account flow — `identifier` is whatever the user typed (e-mail or phone), the backend
// tells the two apart by shape (see auth.repository.ts's findOrCreateGhostUser).
export interface RequestOtpPayload {
  identifier: string;
}

export interface RequestOtpResponse {
  message: string;
  // Only present outside production (see auth.service.ts's requestOtp dev-stub) — lets
  // AuthBottomSheet pre-fill/display the code so the whole flow is testable without a real
  // email/SMS provider.
  devCode?: string;
}

export interface VerifyOtpPayload {
  identifier: string;
  code: string;
}
