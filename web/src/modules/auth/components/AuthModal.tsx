import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAuthStore, type AttemptedAction } from '../store/useAuthStore';
import { useLogin, useRegister } from '../api/useAuth';

interface AuthModalProps {
  // Called once login succeeds, with whatever action (if any) triggered the modal — the
  // caller (AppShell.tsx) owns interpreting what that action actually means and running it;
  // this component only knows how to authenticate, not what "quick sighting" or "add report" do.
  onAuthenticated?: (attemptedAction: AttemptedAction | null) => void;
}

type Mode = 'login' | 'register';

function handleSocialPlaceholder() {
  toast('Logowanie przez social media wkrótce');
}

export function AuthModal({ onAuthenticated }: AuthModalProps) {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);
  const consumeAttemptedAction = useAuthStore((state) => state.consumeAttemptedAction);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const login = useLogin();
  const register = useRegister();

  if (!isOpen) return null;

  const isPending = login.isPending || register.isPending;
  const isError = login.isError || register.isError;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'register') {
      // POST /auth/register doesn't set the session cookie — chain a real login with the
      // same credentials right after, so "join the community" reads as one action to the
      // user even though the backend models it as two requests.
      await register.mutateAsync({ email, password, name });
    }
    await login.mutateAsync({ email, password });

    const action = consumeAttemptedAction();
    closeAuthModal();
    onAuthenticated?.(action);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div style={{ background: 'white', borderRadius: 16, padding: 24, width: 360, maxWidth: '90%' }}>
        <h2>Dołącz do społeczności</h2>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Imię"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Hasło"
            required
            minLength={mode === 'register' ? 8 : undefined}
          />

          {isError && <p role="alert">Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.</p>}

          <button type="submit" disabled={isPending}>
            {isPending ? 'Chwileczkę…' : mode === 'login' ? 'Zaloguj' : 'Zarejestruj'}
          </button>
        </form>

        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
        </button>

        <div>
          <button type="button" onClick={handleSocialPlaceholder}>
            Continue with Google
          </button>
          <button type="button" onClick={handleSocialPlaceholder}>
            Continue with Facebook
          </button>
        </div>

        <button type="button" onClick={closeAuthModal}>
          Anuluj
        </button>
      </div>
    </div>
  );
}
