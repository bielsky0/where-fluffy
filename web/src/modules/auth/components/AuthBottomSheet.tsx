import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore, type AttemptedAction } from '../store/useAuthStore';
import { useLogin, useRegister } from '../api/useAuth';

interface AuthBottomSheetProps {
  // Called once a session actually exists, with whatever action (if any) triggered the sheet —
  // the caller (AppShell.tsx) owns interpreting what that action means and running it; this
  // component only knows how to authenticate, not what "add a report" or "go to feed" do. Same
  // contract the old AuthModal.tsx exposed.
  onAuthenticated?: (attemptedAction: AttemptedAction | null) => void;
}

type EmailMode = 'login' | 'register';

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
// "Dodaj"/"Zaloguj się", or BottomNav.tsx's gated tabs via useAuthStore.requestAuth) and
// sharing the same open/close/attempted-action contract from useAuthStore — only the visual
// and gesture layer changed.
//
// Backend reality check: auth.service.ts only ever exposes email/password
// register+login (see CLAUDE.md's Auth section) — there is no phone/OTP endpoint to call. The
// phone field below is still built exactly to spec (front-and-center, native numeric/phone
// keyboard, "Dalej" CTA) since that's the requested first impression, but submitting it can't
// actually authenticate anyone yet. Rather than fake a success (this codebase's established
// precedent — see add-listing-wizard/StepFork.tsx's disabled "Znalazłem" tile, LoginPage.tsx's disabled Google
// button — is to say so plainly instead of pretending), "Dalej" surfaces a toast and reveals a
// real, working email/password step underneath, so a guest who lands here can still actually
// log in. The Google/Apple tiles are the same kind of honest placeholder the old AuthModal.tsx
// already had for its own social buttons.
export function AuthBottomSheet({ onAuthenticated }: AuthBottomSheetProps) {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const consumeAttemptedAction = useAuthStore((state) => state.consumeAttemptedAction);

  const [phone, setPhone] = useState('');
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const phoneInputRef = useRef<HTMLInputElement>(null);

  const login = useLogin();
  const register = useRegister();
  const isPending = login.isPending || register.isPending;
  const isError = login.isError || register.isError;

  // Every field resets once the sheet fully closes, so the next open (whatever triggered it)
  // starts from a clean slate rather than resuming a half-filled form from an unrelated attempt.
  useEffect(() => {
    if (isOpen) return;
    setPhone('');
    setShowEmailStep(false);
    setEmailMode('login');
    setEmail('');
    setPassword('');
    setName('');
  }, [isOpen]);

  // Flow 1: mounting the sheet also mounts the native phone/numeric keyboard — focusing the
  // input is deferred one frame so it lands after the slide-up transition starts rather than
  // racing it. Only while the phone step is actually showing; once showEmailStep flips true
  // there's a different field to focus, not this one.
  useEffect(() => {
    if (!isOpen || showEmailStep) return;
    const raf = requestAnimationFrame(() => phoneInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isOpen, showEmailStep]);

  if (!isOpen) return null;

  const handlePhoneSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) return;
    toast('Logowanie przez SMS pojawi się wkrótce — użyj adresu e-mail poniżej.');
    setShowEmailStep(true);
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Mirrors AuthModal.tsx's original chaining: POST /auth/register doesn't set the session
    // cookie, so "join the community" still needs a real login call right after to establish one.
    if (emailMode === 'register') {
      await register.mutateAsync({ email, password, name });
    }
    await login.mutateAsync({ email, password });

    const action = consumeAttemptedAction();
    closeAuthModal();
    onAuthenticated?.(action);
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

              {!showEmailStep ? (
                <form onSubmit={handlePhoneSubmit} className="mt-8 flex flex-col gap-4">
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Numer telefonu"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-base text-black placeholder:text-neutral-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-full bg-rose-600 py-4 text-center text-base font-bold text-white transition-colors active:bg-rose-700"
                  >
                    Dalej
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmailSubmit} className="mt-8 flex flex-col gap-3">
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

              {!showEmailStep && (
                <button
                  type="button"
                  onClick={() => setShowEmailStep(true)}
                  className="mt-6 text-center text-sm font-semibold text-neutral-500"
                >
                  Zaloguj się e-mailem
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
