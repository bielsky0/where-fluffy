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
    queryFn: () => apiFetch<Pet[]>(`/pets/nearby?${buildNearbyQueryString(query)}`),
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
      queryClient.invalidateQueries({ queryKey: ['pets', 'nearby'] });
    },
  });
}
