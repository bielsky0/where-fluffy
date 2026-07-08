import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../api/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const login = useLogin();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await login.mutateAsync({ email, password });
    navigate('/app/pets');
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

      {/* Structural placeholder for this module's SSO responsibility — not a working
         integration. auth.routes.ts only exposes /register, /login, /logout today; there's
         no OAuth provider on the backend to call yet. Wire this up once one exists. */}
      <button type="button" disabled title="SSO is not available yet">
        Continue with Google
      </button>
    </main>
  );
}
