import type { CSSProperties } from 'react';

export interface Coordinate {
  lat: number;
  lng: number;
}

// Viewport rectangle in [lng, lat] order, matching the backend's bbox=minLng,minLat,maxLng,maxLat
// query param shape (src/shared/schemas/bbox.schema.ts) — kept here rather than importing from
// shared/lib/bbox.ts so this map abstraction stays free of any app-specific import.
export interface BoundsRect {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
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
  // Disables dragging/zoomControl/scrollWheelZoom/touchZoom all at once — for a glanceable
  // "here's roughly where" preview (e.g. the pet-detail mini-map) that shouldn't compete for
  // gesture/scroll ownership with its surrounding page. Tiles still load; only user interaction
  // is disabled. Defaults to `true` (the map explorer's normal, fully interactive mode).
  interactive?: boolean;
  // Imperative re-center, separate from `center` — react-leaflet's MapContainer only reads
  // `center` on mount (see providers/LeafletMap.tsx), so panning to a newly-selected pet (e.g.
  // tapping a card in the results drawer) has to go through this instead of just changing `center`.
  focusCenter?: Coordinate | null;
  // Opt-in "drag map, read where it settled" hook — fires once per user pan, after the map
  // stops moving (Leaflet's `moveend`), with the map's current center. Added for the add-listing
  // wizard's map-pinning step (a fixed center-screen pin, map moves underneath it), which needs
  // exactly the center Leaflet itself is tracking rather than duplicating that state. Left
  // undefined by any caller that doesn't need it — see providers/LeafletMap.tsx's CenterTracker.
  onCenterChange?: (center: Coordinate) => void;
  // Opt-in "panning just started" hook (Leaflet's `movestart`), fired once per gesture before
  // the map actually moves. Added alongside `onCenterChange` for the add-listing wizard's map
  // pin (StepMapPin.tsx), which lifts/bounces the fixed center pin while the user is actively
  // dragging and settles it back down on `onCenterChange`'s `moveend`. Left undefined by any
  // caller that doesn't need it.
  onMoveStart?: () => void;
  // Opt-in "drag/zoom map, read the viewport rectangle it settled on" hook — also `moveend`
  // (fires alongside onCenterChange when both are given), for callers that need the whole
  // viewport rather than just its center (the map explorer's dual-query bbox fetch). Separate
  // prop rather than folding into onCenterChange since most callers only need one or the other.
  onBoundsChange?: (bounds: BoundsRect) => void;
}
