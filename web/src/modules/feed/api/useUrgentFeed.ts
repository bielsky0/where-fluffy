import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { Pet } from '@/modules/pets/types/pet.types';
import type { FeedQueryParams } from '../types/feed.types';

// GET /pets/feed/urgent — server-enforced LIMIT 10, closest missing pets. Same useQuery idiom
// as modules/pets/api/usePets.ts's usePets, but a distinct hook/endpoint: unlike /pets/nearby,
// this one is category-filterable and hard-capped server-side (see pets.repository.ts's
// findNearLocation options param / feed.service.ts's getUrgentNearby). /pets/nearby itself is
// left completely untouched — MapExplorerPage/PetDetailPage keep using it as-is.
function buildUrgentQueryString({ lat, lng, radius, category }: FeedQueryParams): string {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (radius !== undefined) params.set('radius', String(radius));
  if (category) params.set('category', category);
  return params.toString();
}

export function useUrgentFeed(query: FeedQueryParams) {
  return useQuery({
    queryKey: ['pets', 'feed', 'urgent', query],
    queryFn: () => apiFetch<Pet[]>(`/pets/feed/urgent?${buildUrgentQueryString(query)}`),
  });
}
