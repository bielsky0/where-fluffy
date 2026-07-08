import type { Pet } from '../types/pet.types';

// Client-side-only "recency" filter for the search wizard's Card 3 ("Kiedy?") — like
// petType.ts's matchesPetType, there's no backend query param for this (NearbyPetsQuery only
// takes lat/lng/radius), so it's applied against each pet's own `createdAt` after the fact.
export type TimeframeFilter = '24h' | '3d' | 'all';

export const TIMEFRAME_LABELS: Record<TimeframeFilter, string> = {
  '24h': 'Ostatnie 24 godziny',
  '3d': 'Ostatnie 3 dni',
  all: 'Wszystkie',
};

const TIMEFRAME_WINDOW_MS: Record<Exclude<TimeframeFilter, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
};

export function matchesTimeframe(pet: Pet, timeframe: TimeframeFilter): boolean {
  if (timeframe === 'all') return true;
  const ageMs = Date.now() - new Date(pet.createdAt).getTime();
  return ageMs <= TIMEFRAME_WINDOW_MS[timeframe];
}
