import type { CSSProperties } from 'react';

export interface Coordinate {
  lat: number;
  lng: number;
}

// Tone drives the marker pill's accent color — kept as a generic semantic name (not
// "missing"/"found") so the map abstraction stays domain-agnostic; callers map their own
// status enum onto one of these two.
export type MapMarkerTone = 'danger' | 'warning';

// One pin on the map, rendered as an Airbnb-style pill capsule (see providers/LeafletMap.tsx)
// rather than a classic dropped pin. Deliberately provider-agnostic and domain-agnostic — no
// `Pet` here — so callers (e.g. modules/pets/components/MapView.tsx) map their own domain type
// onto this shape rather than the map abstraction knowing about pets. `emoji`/`freshness` are
// kept as two separate fields (not one pre-joined label string) so the provider can color the
// freshness text by `tone` independently of the emoji, which always renders in its native color.
export interface MapMarkerProps {
  id: string;
  position: Coordinate;
  opacity?: number;
  onClick?: () => void;
  emoji: string;
  freshness: string;
  tone: MapMarkerTone;
  selected?: boolean;
}

export interface MapProps {
  center: Coordinate;
  zoom?: number;
  markers?: MapMarkerProps[];
  className?: string;
  style?: CSSProperties;
  // Imperative re-center, separate from `center` — react-leaflet's MapContainer only reads
  // `center` on mount (see providers/LeafletMap.tsx), so panning to a newly-selected pet (e.g.
  // tapping a card in the results drawer) has to go through this instead of just changing `center`.
  focusCenter?: Coordinate | null;
}
