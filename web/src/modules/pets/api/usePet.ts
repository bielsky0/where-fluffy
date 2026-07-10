import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { Pet } from '../types/pet.types';

// GET /pets/:petId (src/modules/pets/pets.controller.ts's getById) — public, no auth required.
// Detail data changes rarely once a report exists, so this overrides the QueryClient's 30s
// default staleTime with a much longer one.
export function usePet(petId: string | undefined) {
  return useQuery({
    queryKey: ['pets', petId],
    queryFn: ({ signal }) => apiFetch<Pet>(`/pets/${petId}`, { signal }),
    enabled: Boolean(petId),
    staleTime: 5 * 60 * 1000,
  });
}
