interface HeroProps {
  onGetStarted: () => void;
}

// Deliberately dependency-light: no TanStack Query, no Zustand, no socket.io — this component
// (and the LandingPage that renders it) must stay cheap enough that visiting `/` never pulls
// in the app-shell's heavier chunks (see routes.tsx's per-route dynamic imports).
export function Hero({ onGetStarted }: HeroProps) {
  return (
    <section>
      <h1>Lost a pet? Let's find them together.</h1>
      <p>
        Report a missing pet, get location-tagged sightings from your community, and chat in
        real time once someone spots them.
      </p>
      <button type="button" onClick={onGetStarted}>
        Get started
      </button>
    </section>
  );
}
