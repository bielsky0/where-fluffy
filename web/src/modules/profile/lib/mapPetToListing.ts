import type { Pet } from '@/modules/pets/types/pet.types';
import type { ProfileListing } from '../types/profile.types';

// kind is computed, not stored — a pet with status 'found' is a finder's own stray-sighting
// report (a real, ownable Pet row, see profile.types.ts's own comment), rendered as "Widziany".
// 'paused'/'resolved' pets are still the owner's original missing-pet report, so they keep
// kind 'missing' too — ProfilePage.tsx buckets by `status`, not `kind`, for active/archived.
export function mapPetToListing(pet: Pet): ProfileListing {
  return {
    id: pet.id,
    kind: pet.status === 'found' ? 'sighting' : 'missing',
    status: pet.status,
    petName: pet.name,
    speciesLabel: pet.species,
    createdAt: pet.createdAt,
    location: pet.location,
    photoUrl: pet.photoUrls[0] ?? null,
  };
}
