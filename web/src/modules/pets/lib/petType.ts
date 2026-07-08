import type { Pet } from '../types/pet.types';

// Coarse pet-type filter for the search wizard (SearchModal.tsx step 1). The backend's `Pet`
// has a free-text `species` field, not an enum, so this is a client-side heuristic match
// rather than a real filter column — good enough for "Kot"/"Pies"/"Inne" buckets without
// needing a backend schema change.
export type PetTypeFilter = 'cat' | 'dog' | 'other';

export const PET_TYPE_LABELS: Record<PetTypeFilter, string> = {
  cat: 'Kot',
  dog: 'Pies',
  other: 'Inne',
};

// Plural forms for the map results overlay's headline (ResultsTopBar.tsx, e.g. "Psy w
// okolicy") — kept alongside the singular labels above rather than pluralizing them at the
// call site, since Polish plurals aren't a mechanical suffix rule.
export const PET_TYPE_LABELS_PLURAL: Record<PetTypeFilter, string> = {
  cat: 'Koty',
  dog: 'Psy',
  other: 'Inne',
};

const CAT_KEYWORDS = ['kot', 'cat'];
const DOG_KEYWORDS = ['pies', 'dog'];
const PET_TYPE_EMOJI: Record<PetTypeFilter, string> = { cat: '🐱', dog: '🐶', other: '🐾' };

// Same free-text species heuristic as matchesPetType below, reused for the map pill markers'
// emoji (MapView.tsx) so both features bucket species into cat/dog/other identically.
export function petEmoji(species: string): string {
  const value = species.toLowerCase();
  if (CAT_KEYWORDS.some((keyword) => value.includes(keyword))) return PET_TYPE_EMOJI.cat;
  if (DOG_KEYWORDS.some((keyword) => value.includes(keyword))) return PET_TYPE_EMOJI.dog;
  return PET_TYPE_EMOJI.other;
}

export function matchesPetType(pet: Pet, petType: PetTypeFilter | null): boolean {
  if (!petType) return true;
  const species = pet.species.toLowerCase();
  const isCat = CAT_KEYWORDS.some((keyword) => species.includes(keyword));
  const isDog = DOG_KEYWORDS.some((keyword) => species.includes(keyword));

  if (petType === 'cat') return isCat;
  if (petType === 'dog') return isDog;
  return !isCat && !isDog;
}
