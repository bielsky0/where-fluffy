// GET /pets/mine (pets.controller.ts's listMine) now backs the active/archived listing feeds —
// see useMyPets.ts/mapPetToListing.ts. What's left here is genuinely still unbacked by any
// endpoint: User has no createdAt field (auth.types.ts) and nothing tracks a "pets helped" count
// anywhere server-side. Same "don't fake a capability we don't have, but still render a
// believable screen" stance already taken by MOCK_REPORTER_NAME (PetDetailPage.tsx) and
// MOCK_RECENT_SEARCHES (SearchModal.tsx).

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
