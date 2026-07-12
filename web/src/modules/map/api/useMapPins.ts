import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { bboxToQueryValue, roundBbox, type Bbox } from '@/shared/lib/bbox';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';
import type { MapPin } from '../types/mapPin.types';

function buildPinsQueryString(bbox: Bbox, category: PetTypeFilter | null): string {
  const params = new URLSearchParams({ bbox: bboxToQueryValue(bbox) });
  if (category) params.set('category', category);
  return params.toString();
}

// GET /map/pins — the lightweight half of the dual-query map architecture (see CLAUDE.md).
// `null` bbox means "no viewport yet" (before the map's first render/moveend) — `enabled: false`
// then, rather than firing a request with garbage coordinates.
export function useMapPins(bbox: Bbox | null, category: PetTypeFilter | null = null) {
  const roundedBbox = bbox ? roundBbox(bbox) : null;

  return useQuery({
    queryKey: ['map', 'pins', roundedBbox, category],
    queryFn: ({ signal }) => apiFetch<MapPin[]>(`/map/pins?${buildPinsQueryString(roundedBbox!, category)}`, { signal }),
    enabled: roundedBbox !== null,
    // A pin click flies/pans the map, which itself changes the bbox that keys this query —
    // without this, `data` goes undefined mid-refetch, `pins` collapses to `[]`, MapView.tsx's
    // `selectedPin` resolves to null, `focusCenter` falls back to `center`, and FlyToFocus
    // (LeafletMap.tsx) flies away from the pin it was just asked to fly to — a bounce-back loop.
    placeholderData: keepPreviousData,
  });
}
