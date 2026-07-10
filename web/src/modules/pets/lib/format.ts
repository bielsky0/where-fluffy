import type { Coordinate } from '@/shared/components/map/types';

// A Znalazca (finder, V2 wizard) doesn't know the pet's name, so `Pet.name` is nullable — these
// two helpers centralize the display fallback rather than repeating `pet.name ?? '...'`/
// `(pet.name ?? '?').charAt(0)` at every call site (PetCard, PetDetailPanel, HeroGallery,
// StoryModeOverlay, PetDetailPage).
export function getPetDisplayName(pet: { name: string | null; species: string }): string {
  return pet.name ?? `Znaleziony ${pet.species.toLowerCase()}`;
}

export function getPetDisplayInitial(pet: { name: string | null }): string {
  return (pet.name ?? '?').charAt(0).toUpperCase();
}

const EARTH_RADIUS_M = 6371000;

// Haversine great-circle distance — the map/pins are already lat/lng-only (no server-computed
// distance field on PetResponseDTO), so "how far is this pet" for the results list is a
// client-side estimate against the current search origin, not a PostGIS ST_Distance value.
export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Relative-time label for PetCard's `createdAt` — no other module has a shared "time ago"
// helper yet (ChatMessageBubble/SightingLogList both just call toLocaleString directly), so
// this stays pets-local rather than living in shared/lib until a second consumer needs it.
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MINUTE) return 'przed chwilą';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min temu`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} godz. temu`;
  return `${Math.floor(diff / DAY)} dni temu`;
}

// Compact "freshness" label for the map pill markers (MapView.tsx) — same age buckets as
// formatRelativeTime but without the "temu" suffix, since the marker pill already reads
// unambiguously as a timestamp next to its species emoji (e.g. "🐶 20 min").
export function formatRelativeTimeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MINUTE) return 'teraz';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} godz.`;
  return `${Math.floor(diff / DAY)} dni`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Fixed "DD.MM.YYYY, HH:mm" timestamp for PetDetailPage's sighting timeline — deliberately not
// `toLocaleString()` (SightingLogList's own approach) since the timeline's strict layout spec
// wants one exact, locale-independent format rather than whatever the visitor's browser locale
// happens to render.
export function formatTimelineTimestamp(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
