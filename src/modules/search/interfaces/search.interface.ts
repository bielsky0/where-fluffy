import { IPet } from '../../pets/interfaces/pets.interface.js';

export type ISearchResult = IPet & { similarity: number };

// Funkcyjny kontrakt repozytorium (do wstrzykiwania przez domknięcie w service/testach) —
// osobny od PetRepository mimo tej samej tabeli, bo kształt zapytania (ranking przez
// odległość kosinusową) jest fundamentalnie inny, dokładnie tak jak feed/pets już to
// rozwiązały dla swoich własnych kształtów zapytań.
export type SearchRepository = {
  findSimilar: (queryVector: number[], limit: number) => Promise<ISearchResult[]>;
};
