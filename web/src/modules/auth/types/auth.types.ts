// Mirrors src/modules/auth/dto/*.dto.ts and interface/user.interface.ts (password field
// excluded — the backend never sends it back). Duplicated here for the same shared-types/
// placeholder reason as pets/chat.types.ts. `email` stays nullable for type-level backward
// compatibility with any pre-existing phone-only Ghost Account rows — new accounts (password,
// OTP, or OAuth) always have one now, phone-based login has been removed (see auth.schema.ts).
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

// Ghost Account flow — e-mail only now (no SMS, ever — see the spec this shipped against).
export interface RequestOtpPayload {
  email: string;
}

export interface RequestOtpResponse {
  message: string;
  // Only present outside production (see auth.service.ts's requestOtp dev-stub) — lets
  // AuthBottomSheet pre-fill/display the code so the whole flow is testable without a real
  // email provider.
  devCode?: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}
