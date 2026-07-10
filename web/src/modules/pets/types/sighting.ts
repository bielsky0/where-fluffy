// Domain-facing "sighting" model — the backend still calls this resource a "comment"
// (src/modules/comments), nested under /pets/:petId/comments (see CLAUDE.md's "sighting
// points" note). Field names differ from the wire DTO (CommentResponseDTO: `message`, no
// photo at all): `description` here maps to `message`, and `photoUrl` has nothing to map
// from — there is no upload endpoint or file storage anywhere in this repo yet. It's kept
// as `string | null` (always `null` today) so this type doesn't need a breaking rename the
// day photo upload ships. See api/useSightings.ts for the mapping.
export interface Sighting {
  id: string;
  petId: string;
  userId: string;
  location: { lat: number; lng: number } | null;
  description: string;
  photoUrl: string | null;
  timestamp: string;
  type: SightingType;
}

// Matches createCommentSchema (src/modules/comments/comments.schema.ts) — `location` is
// required only when `type === 'sighted'`, enforced server-side via a zod `.refine`.
export type SightingType = 'sighted' | 'area_checked_empty' | 'general';

export interface CreateSightingPayload {
  description: string;
  type: SightingType;
  location?: { lat: number; lng: number };
}
