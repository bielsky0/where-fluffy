import { Prisma, type PrismaClient } from '@prisma/client';
import { MapRepository, MapStatsResult } from './interfaces/map.interface.js';
import { mapPinRowToDomain, RawMapPinRow } from './map.mapper.js';

// Safety-valve cap on rows returned per request — this endpoint deliberately has no pagination
// (the point is "everything currently in view/range, for clustering"), so without a hard ceiling
// a large bbox/radius over a dense area could return an unbounded row count.
const PINS_LIMIT = 2000;

export const createMapRepository = (prisma: PrismaClient): MapRepository => {
  // Kolumny wybierane jawnie (bez "*") — surowa kolumna "location" jest typu
  // Unsupported("geography") i Prisma nie potrafi jej zdeserializować z $queryRaw. "id" bez
  // rzutowania na ::uuid, bo kolumna w bazie ma typ TEXT.
  const findPins: MapRepository['findPins'] = async ({ bbox, lat, lng, radiusInMeters, category }) => {
    const categoryFragment = category ? Prisma.sql`AND category = ${category}` : Prisma.empty;

    // "&&" (bounding-box overlap, GiST-indexed) dla trybu bbox vs. ST_DWithin (ten sam indeks) dla
    // trybu promienia — map.schema.ts's .refine() gwarantuje, że dokładnie jeden z
    // bbox/lat+lng+radius jest podany. status IN ('missing', 'found') — 'paused'/'resolved'
    // zgłoszenia celowo znikają z map pinów, tak samo jak z publicznego feedu.
    const locationFragment = bbox
      ? Prisma.sql`location && ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326)::geography`
      : Prisma.sql`ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusInMeters})`;

    const rows = await prisma.$queryRaw<RawMapPinRow[]>`
      SELECT id, status, category, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
      FROM "Pet"
      WHERE ${locationFragment}
      AND status IN ('missing', 'found')
      ${categoryFragment}
      LIMIT ${PINS_LIMIT};
    `;

    return rows.map(mapPinRowToDomain);
  };

  // Nigdy nie wybiera surowej kolumny "location" (używana tylko w WHERE) — nie dotyczy jej więc
  // ograniczenie "no SELECT * on geography columns". Rzutowanie ::int na COUNT(*), bo Postgres
  // zwraca bigint, który driver zwróciłby jako string bez tego rzutowania.
  const getStats: MapRepository['getStats'] = async ({ lat, lng, radiusInMeters, category }) => {
    const categoryFragment = category ? Prisma.sql`AND category = ${category}` : Prisma.empty;

    const [row] = await prisma.$queryRaw<MapStatsResult[]>`
      SELECT COUNT(*) FILTER (WHERE status = 'missing')::int AS missing,
             COUNT(*) FILTER (WHERE status = 'found')::int AS found,
             COUNT(*)::int AS total
      FROM "Pet"
      WHERE ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusInMeters})
      AND status IN ('missing', 'found')
      ${categoryFragment};
    `;

    return row;
  };

  return { findPins, getStats };
};
