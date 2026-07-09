import { Prisma, type PrismaClient } from '@prisma/client';
import { MapRepository } from './interfaces/map.interface.js';
import { mapPinRowToDomain, RawMapPinRow } from './map.mapper.js';

// Safety-valve cap on rows returned per bbox request — this endpoint deliberately has no
// pagination (the point is "everything currently in view, for clustering"), so without a hard
// ceiling a zoomed-out viewport over a dense area could return an unbounded row count.
const PINS_LIMIT = 2000;

export const createMapRepository = (prisma: PrismaClient): MapRepository => {
  // Kolumny wybierane jawnie (bez "*") — surowa kolumna "location" jest typu
  // Unsupported("geography") i Prisma nie potrafi jej zdeserializować z $queryRaw. "id" bez
  // rzutowania na ::uuid, bo kolumna w bazie ma typ TEXT.
  const findPinsInBbox: MapRepository['findPinsInBbox'] = async ({ minLng, minLat, maxLng, maxLat, category }) => {
    const categoryFragment = category ? Prisma.sql`AND category = ${category}` : Prisma.empty;

    // "&&" (bounding-box overlap) zamiast ST_Intersects/ST_Within — upuszczanie pinezek nie
    // wymaga dokładnej geometrii, a "&&" korzysta wprost z istniejącego indeksu GiST na "location".
    const rows = await prisma.$queryRaw<RawMapPinRow[]>`
      SELECT id, status, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
      ${categoryFragment}
      LIMIT ${PINS_LIMIT};
    `;

    return rows.map(mapPinRowToDomain);
  };

  return { findPinsInBbox };
};
