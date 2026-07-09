import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { FeedPage, FeedQueryParams } from '../types/feed.types';

function buildFeedQueryString(query: FeedQueryParams, cursor: string | null): string {
  const params = new URLSearchParams({ lat: String(query.lat), lng: String(query.lng) });
  if (query.radius !== undefined) params.set('radius', String(query.radius));
  if (query.category) params.set('category', query.category);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

// GET /pets/feed — cursor-paginated "Wszystkie ogłoszenia" section. `signal` is TanStack
// Query's own per-page AbortSignal (v5 passes it into queryFn automatically) forwarded straight
// into apiFetch — no changes needed to apiFetch itself, `init` is already spread into fetch().
// This alone is what makes a category-change abort the in-flight request: switching `category`
// changes this hook's queryKey, so the component stops observing the old key and TanStack Query
// aborts its now-unobserved in-flight fetch via this same signal.
export function useFeedInfinite(query: FeedQueryParams) {
  return useInfiniteQuery({
    queryKey: ['pets', 'feed', query],
    queryFn: ({ pageParam, signal }) =>
      apiFetch<FeedPage>(`/pets/feed?${buildFeedQueryString(query, pageParam)}`, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
