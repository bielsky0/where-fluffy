import type { PrismaClient } from '@prisma/client';
import { SearchRepository } from './interfaces/search.interface.js';
import { mapToSearchResult, RawSearchRow } from './search.mapper.js';

export const createSearchRepository = (prisma: PrismaClient): SearchRepository => {
  // Kolumny wybierane jawnie (bez "*") — "location"/"embedding" są typu Unsupported i Prisma nie
  // potrafi ich zdeserializować z $queryRaw poza obliczonymi aliasami (ST_Y/ST_X, podobieństwo).
  // Wektor zapytania przekazywany jako tekstowy literał "[v1,v2,...]" rzutowany na ::vector po
  // stronie serwera — ta sama technika co w pets.repository.ts's updateEmbedding.
  const findSimilar: SearchRepository['findSimilar'] = async (queryVector, limit) => {
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const rows = await prisma.$queryRaw<RawSearchRow[]>`
      SELECT id, name, species, status, category, reward, phone, email, "distinguishingMarks",
             "photoUrl", "photoUrls", city, "sourceUrl", "originalContact", "isAdminAdded",
             "ownerId", "createdAt", "updatedAt",
             ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
             1 - (embedding <=> ${vectorLiteral}::vector) as similarity
      FROM "Pet"
      WHERE embedding IS NOT NULL AND status = 'missing'
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit};
    `;

    return rows.map(mapToSearchResult);
  };

  return { findSimilar };
};
