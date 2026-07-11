// Mirrors auth.config.ts's pattern for JWT_SECRET — single source of truth, throws at import
// time in production instead of letting a missing key surface only as a runtime 500 on the
// first OTP-email send (modules/auth/index.ts's emailSender stub).
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "Where's Fluffy <onboarding@resend.dev>";

if (process.env.NODE_ENV === 'production' && !RESEND_API_KEY) {
  throw new Error(
    'RESEND_API_KEY must be set in production (email OTP sending would otherwise fail for every request).',
  );
}
