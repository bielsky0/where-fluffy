export interface RequestOtpDTO {
  identifier: string;
}

export interface VerifyOtpDTO {
  identifier: string;
  code: string;
}

// Zwracany tylko gdy NODE_ENV !== 'production' (patrz auth.service.ts's requestOtp) — w produkcji
// kod trafia wyłącznie do dostawcy e-mail/SMS (jeszcze niezintegrowanego), nie do odpowiedzi HTTP.
export interface RequestOtpResponseDTO {
  message: string;
  devCode?: string;
}
