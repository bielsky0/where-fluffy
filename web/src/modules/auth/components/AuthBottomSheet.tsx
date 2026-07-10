import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { usePendingIntentStore } from '../store/usePendingIntentStore';
import { useLogin } from '../api/useAuth';
import { useOtpEntry } from '../hooks/useOtpEntry';

// 'identifier': e-mail, wysyła kod (Ghost Account flow, krok 1).
// 'otp': wpisanie 6-cyfrowego kodu (krok 2) — sukces loguje dokładnie jak hasło.
// 'password': istniejąca ścieżka e-mail/hasło, login-only teraz — spec zabrania zakładania
// nowych kont hasłowych, więc rejestracja hasłem zniknęła z UI (endpoint /auth/register wciąż
// działa dla API/testów, po prostu nic w tym komponencie już go nie wywołuje).
type Stage = 'identifier' | 'otp' | 'password';

// A phone number is dragged down past this (px) or flicked past this velocity (px/s) ⇒ treat
// it as an intentional dismiss rather than a settling bounce; mirrors BottomSheet.tsx's own
// velocity-threshold reasoning, simplified to a single dismiss/no-dismiss decision since this
// sheet only has one resting position, not three snap points.
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

// Heuristic only (not full phone validation) — just enough to tell "looks like a phone number"
// from "looks like an email", so a user who reflexively types their old phone number (SMS login
// no longer exists, see the spec this shipped against) gets a specific, actionable message
// instead of a generic "invalid email" error.
const PHONE_LIKE_PATTERN = /^[+\d][\d\s\-()]{5,}$/;

function startOAuthRedirect(provider: 'google' | 'facebook') {
  window.location.href = `${API_BASE_URL}/auth/${provider}`;
}

function PawLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-10 text-rose-600" aria-hidden="true">
      <circle cx="7" cy="8" r="2.1" />
      <circle cx="12" cy="5.6" r="2.2" />
      <circle cx="17" cy="8" r="2.1" />
      <path d="M12 11.2c-3.2 0-5.6 2.15-5.6 4.55 0 1.6 1.28 2.75 3 2.75.98 0 1.55-.42 2.6-.42s1.62.42 2.6.42c1.72 0 3-1.15 3-2.75 0-2.4-2.4-4.55-5.6-4.55z" />
    </svg>
  );
}

// Standard four-arc "G" glyph — the same path set used across most open-source "Sign in with
// Google" buttons, reproduced inline (no external image/font request, per this app's asset
// constraints).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-6" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.68 9c0-.593.102-1.17.284-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
    </svg>
  );
}

// Standard Facebook "f" mark — same inline-SVG treatment as GoogleIcon above.
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

// Premium replacement for the old AuthModal.tsx, triggered the same way (GuestTabBar.tsx's
// "Dodaj"/"Zaloguj się", BottomNav.tsx's gated tabs, or AddListingWizard's guest-checkout step,
// all via useProtectedAction) and sharing the same open/close/pendingAction contract from
// useAuthStore — this is now the ONE auth UI everywhere in the app, not one of several. Mounted
// once at the true root (App.tsx), not scoped to AppShell, so it's available on every route
// (spec: "always available" Auth Overlay).
//
// Ghost Account flow: the front-and-center "e-mail" field requests a one-time code (POST
// /auth/otp/request) and, once verified (POST /auth/otp/verify), logs in exactly like the
// password path (same httpOnly `token` cookie, same useAuthStore/SessionBootstrap sync). Outside
// production the backend still echoes the code back (no real send, see auth.service.ts's
// requestOtp) and this component surfaces it via toast for end-to-end testability. The password
// form is kept as a login-only fallback ("Zaloguj hasłem") for pre-existing accounts — no
// password *registration* path remains in this UI (spec: passwordless going forward).
//
// Google/Facebook: real Authorization Code redirects now (see startOAuthRedirect above) — a full
// `window.location.href` navigation away, not a fetch, so this component itself never observes
// the OAuth round trip; the backend's callback sets the session cookie and redirects back to
// /auth/callback (OAuthCallbackPage.tsx), which is what resumes whatever the user was doing
// (see usePendingIntentStore, written by useProtectedAction before this sheet ever opens).
export function AuthBottomSheet() {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const consumePendingAction = useAuthStore((state) => state.consumePendingAction);
  const prefillIdentifier = useAuthStore((state) => state.prefillIdentifier);

  const [stage, setStage] = useState<Stage>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const hasAutoSentPrefill = useRef(false);

  const identifierInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Resolved synchronously, in-page (no reload) — any resumeIntent set moments earlier by
  // useProtectedAction is now stale and must not linger to be replayed later (see
  // usePendingIntentStore's MAX_AGE_MS window, which this preempts).
  const settleInPage = () => {
    const pendingAction = consumePendingAction();
    usePendingIntentStore.getState().clearIntent();
    closeAuthModal();
    pendingAction?.();
  };

  const otpEntry = useOtpEntry({
    email: identifier.trim(),
    onVerified: settleInPage,
  });
  const login = useLogin();
  const isPending = login.isPending;
  const isError = login.isError;
  const looksLikePhoneNumber = PHONE_LIKE_PATTERN.test(identifier.trim()) && !identifier.includes('@');

  // Dev-only convenience — the backend echoes the code back outside production (no real email
  // provider config, or explicitly running outside NODE_ENV=production, see auth.service.ts's
  // requestOtp) so the whole flow is testable end-to-end; fires again on every resend, not just
  // the first send.
  useEffect(() => {
    if (otpEntry.devCode) toast(`Tryb testowy — Twój kod: ${otpEntry.devCode}`);
  }, [otpEntry.devCode]);

  // Every field resets once the sheet fully closes, so the next open (whatever triggered it)
  // starts from a clean slate rather than resuming a half-filled form from an unrelated attempt.
  useEffect(() => {
    if (isOpen) return;
    setStage('identifier');
    setIdentifier('');
    setPassword('');
    hasAutoSentPrefill.current = false;
  }, [isOpen]);

  // prefillIdentifier (set by e.g. AddListingWizard, which already collected the guest's e-mail
  // on step 4): skip the identifier stage entirely and fire the code request immediately,
  // mirroring the old wizard-local PublishOtpModal's "request on mount" behavior — but through
  // this one shared component instead of a second bespoke one.
  useEffect(() => {
    if (!isOpen || !prefillIdentifier || hasAutoSentPrefill.current) return;
    hasAutoSentPrefill.current = true;
    setIdentifier(prefillIdentifier);
    setStage('otp');
    void otpEntry.requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefillIdentifier]);

  // Mounting the sheet also mounts the relevant keyboard — focusing the active stage's input is
  // deferred one frame so it lands after the slide-up transition starts rather than racing it.
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      if (stage === 'identifier') identifierInputRef.current?.focus();
      if (stage === 'otp') codeInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, stage]);

  if (!isOpen) return null;

  const handleIdentifierSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || looksLikePhoneNumber) return;

    const sent = await otpEntry.requestCode();
    if (sent) setStage('otp');
  };

  const handleOtpSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await otpEntry.submit();
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await login.mutateAsync({ email: identifier, password });
    settleInPage();
  };

  // Closing without completing (backdrop tap, drag-dismiss) abandons whatever resumeIntent was
  // set for this attempt — otherwise a stale intent could incorrectly replay against a later,
  // unrelated login (e.g. AppShell.tsx reopening the wizard out of nowhere on a normal reload).
  const handleDismiss = () => {
    usePendingIntentStore.getState().clearIntent();
    closeAuthModal();
  };

  // Flow 2: a fast/far-enough downward drag counts as an explicit dismiss; anything short of
  // that and framer's own `animate` prop springs the sheet straight back to y: 0 on release.
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      handleDismiss();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            role="presentation"
            onClick={handleDismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            // Sits below GuestTabBar/BottomNav's z-[1100] on purpose (see GuestTabBar.tsx's own
            // comment on this stacking) — the nav's opaque white background paints over this
            // dim layer in its own strip, so it reads as staying fully lit and interactive
            // while everything else dims, without needing to carve an explicit hole in the
            // backdrop's own geometry.
            className="fixed inset-0 z-[1050] bg-neutral-900/40 backdrop-blur-sm"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Zaloguj się lub zarejestruj"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            style={{ touchAction: 'none' }}
            // z-[1500]: above both the backdrop and the persistent tab bar, so the sheet reads
            // as emerging from behind/above the bar (see GuestTabBar.tsx) rather than tucking
            // underneath it.
            className="fixed inset-x-0 bottom-0 z-[1500] flex h-[70dvh] flex-col rounded-t-[28px] bg-white px-6 pb-safe shadow-[0_-8px_30px_-6px_rgba(0,0,0,0.25)]"
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300" />

            <div className="flex flex-1 flex-col overflow-y-auto pb-6 pt-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <PawLogo />
                <h2 className="text-2xl font-extrabold tracking-tight text-black">
                  Zaloguj się lub zarejestruj
                </h2>
              </div>

              {stage === 'identifier' && (
                <form onSubmit={(event) => void handleIdentifierSubmit(event)} className="mt-8 flex flex-col gap-4">
                  <input
                    ref={identifierInputRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Adres e-mail"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-base text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />

                  {looksLikePhoneNumber && (
                    <p className="text-sm text-neutral-500">
                      Logowanie numerem telefonu nie jest już dostępne — użyj adresu e-mail lub zaloguj się przez
                      Google/Facebook.
                    </p>
                  )}

                  {otpEntry.isSendingCodeError && (
                    <p role="alert" className="text-sm text-red-600">
                      Nie udało się wysłać kodu. Spróbuj ponownie.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={otpEntry.isSendingCode || looksLikePhoneNumber}
                    className="w-full rounded-full bg-rose-600 py-4 text-center text-base font-bold text-white transition-colors active:bg-rose-700 disabled:opacity-60"
                  >
                    {otpEntry.isSendingCode ? 'Wysyłanie…' : 'Dalej'}
                  </button>
                </form>
              )}

              {stage === 'otp' && (
                <form onSubmit={(event) => void handleOtpSubmit(event)} className="mt-8 flex flex-col gap-4">
                  <p className="text-center text-sm text-neutral-500">
                    Wpisz 6-cyfrowy kod wysłany na <span className="font-semibold text-black">{identifier}</span>
                  </p>
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpEntry.code}
                    onChange={(event) => otpEntry.setCode(event.target.value)}
                    placeholder="000000"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-center text-lg tracking-[0.5em] text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />

                  {otpEntry.errorKind && (
                    <p role="alert" className="text-sm text-red-600">
                      {otpEntry.errorKind === 'invalid' && 'Niepoprawny kod. Spróbuj ponownie.'}
                      {otpEntry.errorKind === 'expired' && 'Kod wygasł. Wyślij nowy kod.'}
                      {otpEntry.errorKind === 'network' && 'Coś poszło nie tak. Spróbuj ponownie.'}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={otpEntry.isVerifying || otpEntry.code.trim().length !== 6}
                    className="w-full rounded-full bg-rose-600 py-4 text-center text-base font-bold text-white transition-colors active:bg-rose-700 disabled:opacity-60"
                  >
                    {otpEntry.isVerifying ? 'Weryfikacja…' : 'Potwierdź'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void otpEntry.requestCode()}
                    disabled={!otpEntry.canResend}
                    className="text-center text-sm font-medium text-neutral-500 disabled:opacity-50"
                  >
                    {otpEntry.canResend
                      ? 'Wyślij kod ponownie'
                      : `Wyślij kod ponownie (${otpEntry.secondsUntilResend}s)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('identifier')}
                    className="text-center text-sm font-medium text-neutral-500"
                  >
                    Zmień adres e-mail
                  </button>
                </form>
              )}

              {stage === 'password' && (
                <form onSubmit={(event) => void handleEmailSubmit(event)} className="mt-8 flex flex-col gap-3">
                  <input
                    type="email"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Email"
                    required
                    autoFocus
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-base text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Hasło"
                    required
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-base text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />

                  {isError && (
                    <p role="alert" className="text-sm text-red-600">
                      Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-full bg-rose-600 py-4 text-center text-base font-bold text-white transition-colors active:bg-rose-700 disabled:opacity-60"
                  >
                    {isPending ? 'Chwileczkę…' : 'Zaloguj'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('identifier')}
                    className="text-center text-sm font-medium text-neutral-500"
                  >
                    Wróć do logowania kodem
                  </button>
                </form>
              )}

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">lub</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => startOAuthRedirect('google')}
                  aria-label="Kontynuuj z Google"
                  className="flex size-14 items-center justify-center rounded-xl border border-neutral-200 bg-white transition-colors active:bg-neutral-50"
                >
                  <GoogleIcon />
                </button>
                <button
                  type="button"
                  onClick={() => startOAuthRedirect('facebook')}
                  aria-label="Kontynuuj z Facebook"
                  className="flex size-14 items-center justify-center rounded-xl border border-neutral-200 bg-white transition-colors active:bg-neutral-50"
                >
                  <FacebookIcon />
                </button>
              </div>

              {stage !== 'password' && (
                <button
                  type="button"
                  onClick={() => setStage('password')}
                  className="mt-6 text-center text-sm font-semibold text-neutral-500"
                >
                  Zaloguj się hasłem
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Also exported as default so App.tsx can lazy-load it with the same asyncComponent() helper
// every other route already uses — that helper's loader type expects a `default` export.
export default AuthBottomSheet;
