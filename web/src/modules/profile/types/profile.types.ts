// There is no "my reports" or "my sightings" endpoint on the backend (pets.service.ts only
// exposes reportMissingPet + listNearby; nothing scoped to the authenticated user — see
// mockProfileData.ts for the full gap this type stands in for). ProfileListing is therefore this
// module's own local shape, not a mirror of a real DTO like Pet/User are.
export type ProfileListingKind = 'missing' | 'sighting';

export interface ProfileListing {
  id: string;
  kind: ProfileListingKind;
  // Sighting rows report a stranger's pet — there's no name to show, only a species guess (see
  // the "Widziany: Pies w typie Beagle" example this module was speced against).
  petName: string | null;
  speciesLabel: string;
  createdAt: string;
  location: { lat: number; lng: number };
}

// Archive rows only ever need enough to render a small desaturated mosaic tile — no status/edit
// affordance, so this stays a strict subset of ProfileListing rather than reusing it wholesale.
export interface ArchivedListing {
  id: string;
  speciesLabel: string;
}
