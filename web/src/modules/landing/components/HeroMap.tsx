import { Map } from '@/shared/components/map/Map';

// Warsaw center — this map is pure decoration (no markers, no interaction), so any real-looking
// city center works; it never has to match a visitor's actual location.
const DECORATIVE_CENTER = { lat: 52.2297, lng: 21.0122 };

// Default-exported (not named) so Hero.tsx can `React.lazy(() => import('./HeroMap'))` it — this
// keeps react-leaflet out of the landing page's initial bundle (see Hero.tsx's own comment on
// bundle isolation) while still rendering the real shared `<Map/>` facade (see
// shared/components/map/Map.tsx) rather than a second, parallel map implementation. Hero.tsx
// wraps this in a `pointer-events-none` container, so there's no need to fight react-leaflet's
// own dragging/scroll-zoom here — those events simply never reach it.
export default function HeroMap() {
  return <Map center={DECORATIVE_CENTER} zoom={13} className="h-full w-full" />;
}
