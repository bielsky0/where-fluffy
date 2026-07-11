import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { Pet, PetStatus } from '@/modules/pets/types/pet.types';

// Any mutation here can change a pet's species/category/status, which affects the public
// feed/map/nearby surfaces too (see feed.repository.ts's/map.repository.ts's paused/resolved
// exclusion) — same invalidation set useCreatePetReport (pets/api/usePets.ts) already uses.
function invalidateAllPetQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['pets', 'mine'] });
  queryClient.invalidateQueries({ queryKey: ['pets', 'nearby'] });
  queryClient.invalidateQueries({ queryKey: ['map', 'pins'] });
  queryClient.invalidateQueries({ queryKey: ['pets', 'feed'] });
}

// GET /pets/mine (auth-required) — src/modules/pets/pets.controller.ts's listMine.
export function useMyPets() {
  return useQuery({
    queryKey: ['pets', 'mine'],
    queryFn: ({ signal }) => apiFetch<Pet[]>('/pets/mine', { signal }),
  });
}

export interface UpdatePetPayload {
  petId: string;
  patch: {
    name?: string;
    species?: string;
    location?: { lat: number; lng: number };
    reward?: number;
    phone?: string;
    email?: string;
    distinguishingMarks?: string;
    photoBase64s?: string[];
  };
}

// PATCH /pets/:petId — pets.controller.ts's update. Never carries `status`, see updatePetSchema.
export function useUpdatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ petId, patch }: UpdatePetPayload) =>
      apiFetch<Pet>(`/pets/${petId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAllPetQueries(queryClient),
  });
}

export interface UpdatePetStatusPayload {
  petId: string;
  status: PetStatus;
}

// PATCH /pets/:petId/status — pets.controller.ts's updateStatus. Powers resolve/pause/resume.
export function useUpdatePetStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ petId, status }: UpdatePetStatusPayload) =>
      apiFetch<Pet>(`/pets/${petId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => invalidateAllPetQueries(queryClient),
  });
}

// DELETE /pets/:petId — pets.controller.ts's remove, 204 No Content (apiClient.ts returns
// undefined for a 204 rather than trying to parse an empty body as JSON).
export function useDeletePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (petId: string) => apiFetch<undefined>(`/pets/${petId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAllPetQueries(queryClient),
  });
}
