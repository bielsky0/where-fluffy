import type { CSSProperties } from 'react';

export interface Coordinate {
  lat: number;
  lng: number;
}

// One pin on the map. Deliberately provider-agnostic and domain-agnostic — no `Pet` here —
// so callers (e.g. modules/pets/components/MapView.tsx) map their own domain type onto this
// shape rather than the map abstraction knowing about pets.
export interface MapMarkerProps {
  id: string;
  position: Coordinate;
  color?: string;
  opacity?: number;
  onClick?: () => void;
}

export interface MapProps {
  center: Coordinate;
  zoom?: number;
  markers?: MapMarkerProps[];
  className?: string;
  style?: CSSProperties;
}
