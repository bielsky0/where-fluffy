import type { ArchivedListing, ProfileListing } from '../types/profile.types';

// Everything in this file is a placeholder standing in for a real "my profile" endpoint that
// doesn't exist yet: PetResponseDTO carries no `ownerId` back to the client (see pet.types.ts),
// and there is no `GET /users/me/pets` or `/users/me/stats` route anywhere in pets.routes.ts or
// auth.routes.ts. Same "don't fake a capability we don't have, but still render a believable
// screen" stance already taken by MOCK_REPORTER_NAME (PetDetailPage.tsx) and
// MOCK_RECENT_SEARCHES (SearchModal.tsx) — once a real endpoint exists, ProfilePage.tsx should
// fetch through a TanStack Query hook instead of importing these constants directly.

export const INITIAL_ACTIVE_LISTINGS: ProfileListing[] = [
  {
    id: 'listing-1',
    kind: 'missing',
    petName: 'Oreo',
    speciesLabel: 'Kot',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    location: { lat: 52.2297, lng: 21.0122 },
  },
  {
    id: 'listing-2',
    kind: 'sighting',
    petName: null,
    speciesLabel: 'Pies w typie Beagle',
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    location: { lat: 52.2405, lng: 21.0234 },
  },
  {
    id: 'listing-3',
    kind: 'missing',
    petName: 'Fiona',
    speciesLabel: 'Papuga',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    location: { lat: 52.2189, lng: 20.9967 },
  },
];

export const ARCHIVED_LISTINGS: ArchivedListing[] = [
  { id: 'archive-1', speciesLabel: 'Pies' },
  { id: 'archive-2', speciesLabel: 'Kot' },
  { id: 'archive-3', speciesLabel: 'Kot' },
  { id: 'archive-4', speciesLabel: 'Królik' },
];

// Seed value for the "Pomogłeś" stat — increments locally each time a listing is marked
// "Odnaleziony" (see ProfilePage.tsx's handleResolve). Nothing on the backend tracks this today.
export const INITIAL_HELPED_COUNT = 7;

// Fixed mock join date driving the "Rok/Miesiąc" stat — User has no `createdAt` field
// (auth.types.ts), so this is a stand-in constant rather than a real account timestamp.
export const MOCK_ACCOUNT_CREATED_AT = new Date(Date.now() - 410 * 24 * 3600 * 1000).toISOString();

export function getAccountAgeStat(createdAtIso: string): { value: number; label: string } {
  const msPerMonth = 30 * 24 * 3600 * 1000;
  const months = Math.max(1, Math.floor((Date.now() - new Date(createdAtIso).getTime()) / msPerMonth));

  if (months >= 12) {
    const years = Math.floor(months / 12);
    return { value: years, label: years === 1 ? 'Rok na Fluffy' : 'Lata na Fluffy' };
  }
  return { value: months, label: months === 1 ? 'Miesiąc na Fluffy' : 'Miesiące na Fluffy' };
}
