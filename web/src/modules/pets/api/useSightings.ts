import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import type { CreateSightingPayload, Sighting } from '../types/sighting';

// Mirrors src/modules/comments/dto/comment-response.dto.ts — the wire shape, not our
// `Sighting` domain type (see types/sighting.ts for why they differ).
interface CommentResponseDTO {
  id: string;
  message: string;
  type: 'sighted' | 'area_checked_empty' | 'general';
  location: { lat: number | null; lng: number | null } | null;
  author: { id: string; name: string };
  createdAt: string;
}

function mapCommentToSighting(petId: string, comment: CommentResponseDTO): Sighting {
  return {
    id: comment.id,
    petId,
    userId: comment.author.id,
    location:
      comment.location?.lat != null && comment.location?.lng != null
        ? { lat: comment.location.lat, lng: comment.location.lng }
        : null,
    description: comment.message,
    photoUrl: null,
    timestamp: comment.createdAt,
  };
}

// GET /pets/:petId/comments (src/modules/pets/pets.routes.ts) — public, no auth required.
export function useSightings(petId: string | undefined) {
  return useQuery({
    queryKey: ['pets', petId, 'sightings'],
    queryFn: async ({ signal }) => {
      const comments = await apiFetch<CommentResponseDTO[]>(`/pets/${petId}/comments`, { signal });
      return comments.map((comment) => mapCommentToSighting(petId!, comment));
    },
    enabled: Boolean(petId),
  });
}

// POST /pets/:petId/comments — auth-required. `networkMode: 'offlineFirst'` (set as the
// QueryClient default, see lib/queryClient.ts) means a submission made while offline is
// *paused*, not failed, and resumes automatically once back online — our "background sync"
// mechanism for reliability (see providers/AppProviders.tsx for why we use this instead of
// the raw Background Sync API).
export function useCreateSighting(petId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSightingPayload) =>
      apiFetch<CommentResponseDTO>(`/pets/${petId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          message: payload.description,
          type: payload.type,
          latitude: payload.location?.lat,
          longitude: payload.location?.lng,
        }),
      }),
    onSuccess: (comment) => {
      queryClient.setQueryData<Sighting[]>(['pets', petId, 'sightings'], (prev) => {
        const next = mapCommentToSighting(petId, comment);
        return prev ? [...prev, next] : [next];
      });
    },
  });
}
