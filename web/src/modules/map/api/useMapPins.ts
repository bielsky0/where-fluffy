import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { bboxToQueryValue, roundBbox, type Bbox } from '@/shared/lib/bbox';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';
import type { Coordinate } from '@/shared/components/map/types';
import type { MapPin } from '../types/mapPin.types';

// Map-viewport mode (MapExplorerPage) vs. radius mode (the public Hero's slider-driven map) —
// mutually exclusive, mirrors the backend's mapPinsQuerySchema XOR (src/modules/map/map.schema.ts).
export type MapPinsQuery =
  | { mode: 'bbox'; bbox: Bbox }
  | { mode: 'radius'; center: Coordinate; radiusMeters: number };

// Rounds to ~1.1m precision at the equator (5 decimal places) — same rationale as roundBbox:
// keeps the query key stable across sub-pixel jitter (GPS noise, slider rounding) without
// visibly changing which pins a radius search returns.
function roundCenter(center: Coordinate, precision = 5): Coordinate {
  const factor = 10 ** precision;
  return { lat: Math.round(center.lat * factor) / factor, lng: Math.round(center.lng * factor) / factor };
}

function buildPinsQueryString(query: MapPinsQuery, category: PetTypeFilter | null): string {
  const params = new URLSearchParams();
  if (query.mode === 'bbox') {
    params.set('bbox', bboxToQueryValue(query.bbox));
  } else {
    params.set('lat', String(query.center.lat));
    params.set('lng', String(query.center.lng));
    params.set('radius', String(query.radiusMeters));
  }
  if (category) params.set('category', category);
  return params.toString();
}

function roundQuery(query: MapPinsQuery): MapPinsQuery {
  return query.mode === 'bbox'
    ? { mode: 'bbox', bbox: roundBbox(query.bbox) }
    : { mode: 'radius', center: roundCenter(query.center), radiusMeters: Math.round(query.radiusMeters) };
}

// GET /map/pins — the lightweight half of the dual-query map architecture (see CLAUDE.md).
// `null` query means "nothing to query yet" (before the map's first render/moveend, or before a
// center is known) — `enabled: false` then, rather than firing a request with garbage coordinates.
export function useMapPins(query: MapPinsQuery | null, category: PetTypeFilter | null = null) {
  const roundedQuery = query ? roundQuery(query) : null;

  return useQuery({
    queryKey: ['map', 'pins', roundedQuery, category],
    queryFn: ({ signal }) =>
      apiFetch<MapPin[]>(`/map/pins?${buildPinsQueryString(roundedQuery!, category)}`, { signal }),
    enabled: roundedQuery !== null,
    // A pin click flies/pans the map, which itself changes the bbox that keys this query —
    // without this, `data` goes undefined mid-refetch, `pins` collapses to `[]`, MapView.tsx's
    // `selectedPin` resolves to null, `focusCenter` falls back to `center`, and FlyToFocus
    // (LeafletMap.tsx) flies away from the pin it was just asked to fly to — a bounce-back loop.
    placeholderData: keepPreviousData,
  });
}
