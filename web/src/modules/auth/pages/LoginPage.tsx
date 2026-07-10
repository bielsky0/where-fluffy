import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/apiClient';
import { useLogin } from '../api/useAuth';

function startOAuthRedirect(provider: 'google' | 'facebook') {
  window.location.href = `${API_BASE_URL}/auth/${provider}`;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const login = useLogin();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await login.mutateAsync({ email, password });
    navigate('/app');
  };

  return (
    <main>
      <form onSubmit={handleSubmit}>
        <h1>Log in</h1>
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
          placeholder="Password"
          required
        />
        {login.isError && <p role="alert">Invalid email or password.</p>}
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {/* Real Authorization Code redirects (see AuthBottomSheet.tsx's startOAuthRedirect, same
         pattern) — a full window.location.href navigation, not a fetch. No resumeIntent needed
         here: this is a standalone route with no prior in-page action to resume, so the
         backend's default /auth/callback -> /app landing is already correct. */}
      <button type="button" onClick={() => startOAuthRedirect('google')}>
        Continue with Google
      </button>
      <button type="button" onClick={() => startOAuthRedirect('facebook')}>
        Continue with Facebook
      </button>
    </main>
  );
}
