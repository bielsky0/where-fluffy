import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@/shared/components/ErrorState';

// Deliberately no imports from modules/pets, modules/chat, or modules/auth (see routes.tsx's
// "public side" comment) — this is reachable via the router's `*` catch-all by anyone, logged in
// or not, so it must stay as light as LandingPage.
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorState
      fullscreen
      icon="🐾"
      title="Ogłoszenie nie istnieje"
      message="To ogłoszenie już wygasło lub zwierzak szczęśliwie wrócił do domu."
      action={{ label: 'Wróć do zgłoszeń', onClick: () => navigate('/app') }}
    />
  );
}
