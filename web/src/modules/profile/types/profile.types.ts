import type { PetStatus } from '@/modules/pets/types/pet.types';

// GET /pets/mine (pets.controller.ts's listMine) now backs this module — ProfileListing is a
// thin view-model derived from the real Pet shape (see lib/mapPetToListing.ts), not a mirror of
// its own invented DTO. Kept as its own type rather than using Pet directly because `kind` has
// no backend equivalent: a pet with status 'found' IS a real, ownable Pet row (a finder's own
// stray-sighting report, ownerId = the finder — see pets.controller.ts's create), just one with
// no name to show, hence the "Widziany: Pies w typie Beagle" treatment.
export type ProfileListingKind = 'missing' | 'sighting';

export interface ProfileListing {
  id: string;
  kind: ProfileListingKind;
  status: PetStatus;
  // Sighting rows report a stranger's pet — there's no name to show, only a species guess (see
  // the "Widziany: Pies w typie Beagle" example this module was speced against).
  petName: string | null;
  speciesLabel: string;
  createdAt: string;
  location: { lat: number; lng: number };
  photoUrl: string | null;
}

// Archive rows only ever need enough to render a small desaturated mosaic tile — no status/edit
// affordance, so this stays a strict subset of ProfileListing rather than reusing it wholesale.
export interface ArchivedListing {
  id: string;
  speciesLabel: string;
}
