export type PetCategory = 'dog' | 'cat' | 'other';

// Backend port of web/src/modules/pets/lib/petType.ts's CAT_KEYWORDS/DOG_KEYWORDS — must be
// kept in sync with that file's word lists if either changes. Cat is checked before dog,
// matching petEmoji()'s precedence there (a species matching both keyword sets resolves to
// 'cat', since a single category column can't represent "matches both" the way the frontend's
// independent isCat/isDog booleans can).
const CAT_KEYWORDS = ['kot', 'cat'];
const DOG_KEYWORDS = ['pies', 'dog'];

export function categorizePetSpecies(species: string): PetCategory {
  const value = species.toLowerCase();
  if (CAT_KEYWORDS.some((keyword) => value.includes(keyword))) return 'cat';
  if (DOG_KEYWORDS.some((keyword) => value.includes(keyword))) return 'dog';
  return 'other';
}
