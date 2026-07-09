import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { CreatePetReportPayload, NearbyPetsQuery, Pet } from '../types/pet.types';

// Matches GET /pets/nearby (src/modules/pets/pets.controller.ts's listNearby) — lat/lng are
// required, radius is optional and left to the backend's own default when omitted.
function buildNearbyQueryString({ lat, lng, radius }: NearbyPetsQuery): string {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (radius !== undefined) {
    params.set('radius', String(radius));
  }
  return params.toString();
}

export function usePets(query: NearbyPetsQuery) {
  return useQuery({
    queryKey: ['pets', 'nearby', query],
    queryFn: ({ signal }) => apiFetch<Pet[]>(`/pets/nearby?${buildNearbyQueryString(query)}`, { signal }),
  });
}

// POST /pets (auth-required) — src/modules/pets/pets.service.ts's `reportMissingPet`. Like
// useSightings' create mutation, this inherits `networkMode: 'offlineFirst'` from the
// QueryClient defaults, so an "Add Report" submitted while offline queues instead of failing
// (see add-listing-wizard/AddListingWizard.tsx / providers/AppProviders.tsx).
export function useCreatePetReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePetReportPayload) =>
      apiFetch<Pet>('/pets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Also invalidates the map explorer's bbox-keyed queries (useMapPins/useFeedInfiniteBbox)
      // — MapExplorerPage.tsx no longer reads from ['pets','nearby'], so invalidating only that
      // key would leave a newly created report invisible on the map/drawer until those queries'
      // own staleness naturally expires.
      queryClient.invalidateQueries({ queryKey: ['pets', 'nearby'] });
      queryClient.invalidateQueries({ queryKey: ['map', 'pins'] });
      queryClient.invalidateQueries({ queryKey: ['pets', 'feed'] });
    },
  });
}
