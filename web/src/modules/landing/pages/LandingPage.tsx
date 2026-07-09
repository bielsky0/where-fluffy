import { useNavigate } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { PillarsSection } from '../components/PillarsSection';
import { SmartAlertSection } from '../components/SmartAlertSection';
import { ShowcaseSection } from '../components/ShowcaseSection';
import { FaqSection } from '../components/FaqSection';

// Public marketing entry point — only imports react-router-dom (already shared by every
// route), framer-motion (a plain peer dependency), and its own section components. Must never
// import from modules/pets, modules/chat, or modules/auth: those pull in TanStack Query,
// socket.io-client, and Zustand, and this bundle is what unauthenticated visitors download first.
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col bg-white">
      <Hero onGetStarted={() => navigate('/app')} />
      <PillarsSection />
      <SmartAlertSection />
      <ShowcaseSection />
      <FaqSection />
    </main>
  );
}
