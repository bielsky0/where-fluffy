import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { bboxToQueryValue, roundBbox, type Bbox } from '@/shared/lib/bbox';
import type { PetTypeFilter } from '@/modules/pets/lib/petType';
import type { FeedPage } from '../types/feed.types';

function buildFeedBboxQueryString(bbox: Bbox, category: PetTypeFilter | null, cursor: string | null): string {
  const params = new URLSearchParams({ bbox: bboxToQueryValue(bbox) });
  if (category) params.set('category', category);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

// GET /pets/feed in bbox (map-viewport) mode — sibling to useFeedInfinite.ts (proximity mode,
// still used unmodified by the main FeedList) rather than a modification of it, since the two
// modes are mutually exclusive query shapes (see feed.schema.ts's .refine()) and this hook's
// only caller (the map explorer's results drawer) never needs proximity mode.
export function useFeedInfiniteBbox(bbox: Bbox | null, category: PetTypeFilter | null = null) {
  const roundedBbox = bbox ? roundBbox(bbox) : null;

  return useInfiniteQuery({
    queryKey: ['pets', 'feed', 'bbox', roundedBbox, category],
    queryFn: ({ pageParam, signal }) =>
      apiFetch<FeedPage>(`/pets/feed?${buildFeedBboxQueryString(roundedBbox!, category, pageParam)}`, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: roundedBbox !== null,
    // A pin click flies/pans the map, which itself changes the bbox that keys this query — without
    // this, `data` goes undefined mid-refetch, `feedPets` collapses to `[]`, and the just-clicked
    // pet's selection resolves to null and back, which unmounts/remounts PetDetailPanel and flips
    // BottomSheet's `hidden` prop (MapExplorerPage.tsx) on every such pan.
    placeholderData: keepPreviousData,
  });
}
