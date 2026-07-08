import { useNavigate } from 'react-router-dom';
import { Hero } from '../components/Hero';

// Public marketing entry point — only imports react-router-dom (already shared by every
// route) and its own Hero component. Must never import from modules/pets, modules/chat, or
// modules/auth: those pull in TanStack Query, socket.io-client, and Zustand, and this bundle
// is what unauthenticated visitors download first.
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main>
      <Hero onGetStarted={() => navigate('/login')} />
    </main>
  );
}
