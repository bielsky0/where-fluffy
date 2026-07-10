import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { GeocodeResult } from '../types/geocode.types';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// Debounces the *value*, not the call — deliberately not useDebouncedCallback
// (shared/hooks/useDebouncedCallback.ts), which is a stable-identity debounced callback wrapper
// built for handing a never-changing function reference into an event subscription (its
// motivating case is react-leaflet's useMapEvent), the wrong shape for search-as-you-type.
// Keying useQuery on the debounced value lets TanStack Query's own per-queryKey AbortSignal
// cancel a superseded in-flight request automatically (same mechanism useMapPins.ts already
// relies on) with no manual AbortController bookkeeping.
export function useLocationSearch(rawQuery: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(rawQuery);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(rawQuery), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [rawQuery]);

  const trimmed = debouncedQuery.trim();

  return useQuery({
    queryKey: ['geocode', 'search', trimmed],
    queryFn: ({ signal }) => apiFetch<GeocodeResult[]>(`/geocode/search?q=${encodeURIComponent(trimmed)}`, { signal }),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 60_000,
  });
}
