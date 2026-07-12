import { useMemo } from 'react';
import { Map } from '@/shared/components/map/Map';
import type { Coordinate, MapMarkerProps } from '@/shared/components/map/types';
import type { MapPin } from '@/modules/map/types/mapPin.types';

const CATEGORY_EMOJI: Record<MapPin['category'], string> = { dog: '🐶', cat: '🐱', other: '🐾' };
const STATUS_LABEL: Record<MapPin['status'], string> = { missing: 'Zaginiony', found: 'Znaleziony' };

interface HeroMapProps {
  center: Coordinate;
  radiusMeters: number;
  pins: MapPin[];
  onPinClick: (pin: MapPin) => void;
}

// Default-exported (not named) so Hero.tsx can `React.lazy(() => import('./HeroMap'))` it — keeps
// react-leaflet out of the landing page's initial bundle (see Hero.tsx's own comment on bundle
// isolation). Unlike the old purely decorative version, this now renders real markers plus a
// spring-animated radar circle over a muted (CARTO Positron, no-labels) basemap — still the one
// shared `<Map/>` facade, not a second parallel map implementation.
export default function HeroMap({ center, radiusMeters, pins, onPinClick }: HeroMapProps) {
  const markers = useMemo<MapMarkerProps[]>(
    () =>
      pins.map((pin) => ({
        id: pin.id,
        position: { lat: pin.lat, lng: pin.lng },
        emoji: CATEGORY_EMOJI[pin.category],
        freshness: STATUS_LABEL[pin.status],
        tone: pin.status === 'missing' ? 'danger' : 'warning',
        onClick: () => onPinClick(pin),
      })),
    [pins, onPinClick],
  );

  return (
    <Map
      center={center}
      // MapContainer's own `center` prop only applies once, on mount (see LeafletMap.tsx's own
      // comment) — without `focusCenter`, picking a new location in HeroSearchOverlay (or GPS)
      // updates `center` but the map itself never pans there. `focusCenter` is what MapExplorerPage
      // already uses for the same reason (flying to a newly-selected pet).
      focusCenter={center}
      zoom={12}
      className="h-full w-full"
      tileTheme="muted"
      radiusCircle={{ center, radiusMeters }}
      markers={markers}
    />
  );
}
