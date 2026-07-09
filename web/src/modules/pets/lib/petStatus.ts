import type { PetStatus } from '../types/pet.types';

// Shared by PetCard.tsx (drawer/feed cards) and MapView.tsx (map pins) so a pet's status badge
// reads identically everywhere, whether the caller has a full Pet DTO or just a MapPin.
export const PET_STATUS_LABEL: Record<PetStatus, string> = {
  missing: 'ZAGINĄŁ',
  found: 'WIDZIANY',
};
