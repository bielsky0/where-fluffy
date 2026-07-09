import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { useLogin, useRegister, useRequestOtp, useVerifyOtp } from '../api/useAuth';

type EmailMode = 'login' | 'register';
// 'identifier': e-mail lub telefon, wysyła kod (Ghost Account flow, krok 1).
// 'otp': wpisanie 6-cyfrowego kodu (krok 2) — sukces loguje dokładnie jak hasło.
// 'password': istniejąca ścieżka e-mail/hasło, wciąż dostępna dla już zarejestrowanych kont.
type Stage = 'identifier' | 'otp' | 'password';

// A phone number is dragged down past this (px) or flicked past this velocity (px/s) ⇒ treat
// it as an intentional dismiss rather than a settling bounce; mirrors BottomSheet.tsx's own
// velocity-threshold reasoning, simplified to a single dismiss/no-dismiss decision since this
// sheet only has one resting position, not three snap points.
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6 text-black" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function handleSocialPlaceholder(provider: 'Google' | 'Apple') {
  toast(`Logowanie przez ${provider} pojawi się wkrótce`);
}

// Premium replacement for the old AuthModal.tsx, triggered the same way (GuestTabBar.tsx's
// "Dodaj"/"Zaloguj się", or BottomNav.tsx's gated tabs, both via useProtectedAction) and sharing
// the same open/close/pendingAction contract from useAuthStore — only the visual and gesture
// layer changed. Mounted once at the true root (App.tsx), not scoped to AppShell, so it's
// available on every route (spec: "always available" Auth Overlay).
//
// Ghost Account flow: the front-and-center "e-mail lub telefon" field now actually authenticates
// — it requests a one-time code (POST /auth/otp/request) and, once verified (POST
// /auth/otp/verify), logs in exactly like the password path (same httpOnly `token` cookie,
// same useAuthStore/SessionBootstrap sync). The OTP code itself is dev-only right now (no real
// email/SMS provider is wired up yet, see auth.service.ts's requestOtp) — outside production the
// backend echoes it back and this component surfaces it via toast so the whole flow is testable
// end-to-end. The existing password form is kept as a fallback ("Zaloguj hasłem") for accounts
// that already have one. The Google/Apple tiles remain honest placeholders, same as before.
export function AuthBottomSheet() {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const consumePendingAction = useAuthStore((state) => state.consumePendingAction);

  const [stage, setStage] = useState<Stage>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const identifierInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const login = useLogin();
  const register = useRegister();
  const isPending = login.isPending || register.isPending;
  const isError = login.isError || register.isError;

  // Every field resets once the sheet fully closes, so the next open (whatever triggered it)
  // starts from a clean slate rather than resuming a half-filled form from an unrelated attempt.
  useEffect(() => {
    if (isOpen) return;
    setStage('identifier');
    setIdentifier('');
    setCode('');
    setEmailMode('login');
    setEmail('');
    setPassword('');
    setName('');
  }, [isOpen]);

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
    if (!identifier.trim()) return;

    const result = await requestOtp.mutateAsync({ identifier: identifier.trim() });
    if (result.devCode) {
      toast(`Tryb testowy — Twój kod: ${result.devCode}`);
    }
    setStage('otp');
  };

  const handleOtpSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await verifyOtp.mutateAsync({ identifier: identifier.trim(), code: code.trim() });

    const pendingAction = consumePendingAction();
    closeAuthModal();
    pendingAction?.();
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Mirrors AuthModal.tsx's original chaining: POST /auth/register doesn't set the session
    // cookie, so "join the community" still needs a real login call right after to establish one.
    if (emailMode === 'register') {
      await register.mutateAsync({ email, password, name });
    }
    await login.mutateAsync({ email, password });

    const pendingAction = consumePendingAction();
    closeAuthModal();
    pendingAction?.();
  };

  // Flow 2: a fast/far-enough downward drag counts as an explicit dismiss; anything short of
  // that and framer's own `animate` prop springs the sheet straight back to y: 0 on release.
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
      closeAuthModal();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            role="presentation"
            onClick={closeAuthModal}
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
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="E-mail lub numer telefonu"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-base text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />

                  {requestOtp.isError && (
                    <p role="alert" className="text-sm text-red-600">
                      Nie udało się wysłać kodu. Spróbuj ponownie.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={requestOtp.isPending}
                    className="w-full rounded-full bg-rose-600 py-4 text-center text-base font-bold text-white transition-colors active:bg-rose-700 disabled:opacity-60"
                  >
                    {requestOtp.isPending ? 'Wysyłanie…' : 'Dalej'}
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
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="000000"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-center text-lg tracking-[0.5em] text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />

                  {verifyOtp.isError && (
                    <p role="alert" className="text-sm text-red-600">
                      Nieprawidłowy lub wygasły kod. Spróbuj ponownie.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={verifyOtp.isPending || code.trim().length !== 6}
                    className="w-full rounded-full bg-rose-600 py-4 text-center text-base font-bold text-white transition-colors active:bg-rose-700 disabled:opacity-60"
                  >
                    {verifyOtp.isPending ? 'Weryfikacja…' : 'Potwierdź'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('identifier')}
                    className="text-center text-sm font-medium text-neutral-500"
                  >
                    Zmień e-mail lub numer telefonu
                  </button>
                </form>
              )}

              {stage === 'password' && (
                <form onSubmit={(event) => void handleEmailSubmit(event)} className="mt-8 flex flex-col gap-3">
                  {emailMode === 'register' && (
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Imię"
                      required
                      className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-base text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  )}
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                    minLength={emailMode === 'register' ? 8 : undefined}
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
                    {isPending ? 'Chwileczkę…' : emailMode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'login' ? 'register' : 'login')}
                    className="text-center text-sm font-medium text-neutral-500"
                  >
                    {emailMode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
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
                  onClick={() => handleSocialPlaceholder('Google')}
                  aria-label="Kontynuuj z Google"
                  className="flex size-14 items-center justify-center rounded-xl border border-neutral-200 bg-white transition-colors active:bg-neutral-50"
                >
                  <GoogleIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialPlaceholder('Apple')}
                  aria-label="Kontynuuj z Apple"
                  className="flex size-14 items-center justify-center rounded-xl border border-neutral-200 bg-white transition-colors active:bg-neutral-50"
                >
                  <AppleIcon />
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
