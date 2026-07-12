import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';
import type { Coordinate } from '@/shared/components/map/types';

export interface MapStats {
  total: number;
  missing: number;
  found: number;
}

// Rounds to 2 decimals (~1.1km buckets) — matches map.service.ts's own Redis cache-key rounding,
// so nearby callers/GPS jitter land on the same cached backend response and this query's own
// cache key stays stable too.
function roundCenter(center: Coordinate, precision = 2): Coordinate {
  const factor = 10 ** precision;
  return { lat: Math.round(center.lat * factor) / factor, lng: Math.round(center.lng * factor) / factor };
}

// GET /map/stats — always "around a point" (no bbox alternative, unlike pins). `null` center
// means "nothing to query yet" — `enabled: false` then.
export function useMapStats(center: Coordinate | null, radiusMeters: number, category: PetTypeFilter | null = null) {
  const roundedCenter = center ? roundCenter(center) : null;
  const radiusKm = Math.round(radiusMeters / 1000);

  return useQuery({
    queryKey: ['map', 'stats', roundedCenter, radiusKm, category],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        lat: String(roundedCenter!.lat),
        lng: String(roundedCenter!.lng),
        radius: String(radiusMeters),
      });
      if (category) params.set('category', category);
      return apiFetch<MapStats>(`/map/stats?${params.toString()}`, { signal });
    },
    enabled: roundedCenter !== null,
    // Keeps the last stats visible while a new radius/category combo is in flight, so Hero's
    // count-up/replace transition always has an old value to animate away from — never a blank
    // spinner state (see HeroStats.tsx).
    placeholderData: keepPreviousData,
  });
}
