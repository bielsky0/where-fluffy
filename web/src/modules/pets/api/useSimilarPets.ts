import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { SimilarPet } from '../types/pet.types';

// GET /pets/:petId/similar (src/modules/pets/pets.controller.ts's getSimilar) — public, no auth
// required. This section must never block/degrade the main pet detail view (see
// SimilarPetsCarousel.tsx), so it fails fast rather than retrying: `retry: 0` overrides the
// QueryClient's default, and the 3s AbortSignal.timeout bounds worst-case wait independent of the
// server's own response time.
export function useSimilarPets(petId: string | undefined) {
  return useQuery({
    queryKey: ['pets', petId, 'similar'],
    queryFn: ({ signal }) =>
      apiFetch<SimilarPet[]>(`/pets/${petId}/similar`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
      }),
    enabled: Boolean(petId),
    retry: 0,
    staleTime: 60 * 1000,
  });
}
