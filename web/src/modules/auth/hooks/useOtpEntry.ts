import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/apiClient';
import { useRequestOtp, useVerifyOtp } from '../api/useAuth';

// Comfortably inside otpRequestRateLimiter's server-side budget (3 requests/60s per email,
// see auth.routes.ts) — a full resend cycle here is 30s, leaving headroom for a couple of manual
// resends before the user would ever hit that limit.
const RESEND_COOLDOWN_SECONDS = 30;

export type OtpErrorKind = 'invalid' | 'expired' | 'network' | null;

interface UseOtpEntryOptions {
  // The e-mail the code should be sent to — the caller has already collected this
  // (AuthBottomSheet's 'identifier' stage, possibly pre-filled from the wizard's own contact
  // section — see prefillIdentifier), so this hook only ever drives the request/verify
  // mechanics, never email collection itself.
  email: string;
  // Fires once verifyOtp succeeds — the session cookie is already set by then (see
  // auth.service.ts's verifyOtp), so this is just "what should happen next" for the caller.
  onVerified: () => void;
}

// Generic OTP request/verify mechanics — request/resend/countdown/distinct-error-copy — used by
// AuthBottomSheet's 'otp' stage (the sole auth UI everywhere, including the wizard's guest
// checkout via its prefillIdentifier mode), so nothing else has to re-implement the resend timer
// or the invalid-vs-expired branching on its own. Deliberately does NOT auto-send a code on mount
// — `requestCode()` is the one entry point both the initial send and a manual resend go through,
// called explicitly once a stage transition decides a send should happen.
export function useOtpEntry({ email, onVerified }: UseOtpEntryOptions) {
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  useEffect(() => {
    if (secondsUntilResend <= 0) return;
    const timer = setTimeout(() => setSecondsUntilResend((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsUntilResend]);

  // Returns whether the send succeeded, so a caller like AuthBottomSheet's identifier-stage
  // submit can decide whether to advance to the code-entry stage at all (a failed send should
  // keep the user on the identifier form, not silently drop them into an empty otp stage).
  const requestCode = async (): Promise<boolean> => {
    setDevCode(null);
    setCode('');
    setSecondsUntilResend(RESEND_COOLDOWN_SECONDS);
    try {
      const result = await requestOtp.mutateAsync({ email });
      if (result.devCode) setDevCode(result.devCode);
      return true;
    } catch {
      return false; // surfaced via isSendingCodeError below
    }
  };

  const submit = async () => {
    try {
      await verifyOtp.mutateAsync({ email, code: code.trim() });
      onVerified();
    } catch {
      // Surfaced via errorKind below — nothing else to do here.
    }
  };

  const errorKind: OtpErrorKind = !verifyOtp.isError
    ? null
    : verifyOtp.error instanceof ApiError && verifyOtp.error.code === 'OTP_CODE_EXPIRED'
      ? 'expired'
      : verifyOtp.error instanceof ApiError && verifyOtp.error.code === 'OTP_CODE_INVALID'
        ? 'invalid'
        : 'network';

  return {
    code,
    setCode,
    submit,
    isVerifying: verifyOtp.isPending,
    errorKind,
    secondsUntilResend,
    canResend: secondsUntilResend <= 0 && !requestOtp.isPending,
    requestCode,
    isSendingCode: requestOtp.isPending,
    isSendingCodeError: requestOtp.isError,
    devCode,
  };
}
