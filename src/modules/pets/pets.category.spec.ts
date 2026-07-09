import { categorizePetSpecies } from './pets.category.js';

describe('categorizePetSpecies', () => {
  it('categorizes Polish dog keywords as dog', () => {
    expect(categorizePetSpecies('pies')).toBe('dog');
    expect(categorizePetSpecies('Owczarek (pies)')).toBe('dog');
  });

  it('categorizes English dog keywords as dog', () => {
    expect(categorizePetSpecies('Golden Retriever dog')).toBe('dog');
  });

  it('categorizes Polish cat keywords as cat', () => {
    expect(categorizePetSpecies('kot europejski')).toBe('cat');
  });

  it('categorizes English cat keywords as cat', () => {
    expect(categorizePetSpecies('cat')).toBe('cat');
  });

  it('is case-insensitive', () => {
    expect(categorizePetSpecies('PIES')).toBe('dog');
    expect(categorizePetSpecies('KOT')).toBe('cat');
  });

  it('falls back to other for unmatched species', () => {
    expect(categorizePetSpecies('chomik')).toBe('other');
    expect(categorizePetSpecies('')).toBe('other');
  });

  it('resolves a species matching both cat and dog keywords to cat, matching petType.ts petEmoji precedence', () => {
    expect(categorizePetSpecies('kot i pies')).toBe('cat');
  });
});
