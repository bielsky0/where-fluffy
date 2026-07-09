import { Prisma, type PrismaClient } from '@prisma/client';
import { FeedRepository } from './interfaces/feed.interface.js';
import { mapFeedRowToDomain, RawFeedPetRow } from './feed.mapper.js';

export const createFeedRepository = (prisma: PrismaClient): FeedRepository => {
  // Keyset ("seek") pagination — NOT OFFSET/LIMIT: stable and index-friendly under concurrent
  // inserts. Sort key is "createdAt" DESC, id DESC (not ST_Distance — Postgres KNN
  // distance-ordering has no simple cursor continuation); ST_DWithin (using the existing
  // Pet_location_idx GiST index) does the proximity filtering, and ST_Distance is only a
  // SELECT-ed column for the DTO's distanceMeters field. Deliberately does not filter
  // status = 'missing' — this section shows both missing/found pets with a status badge.
  const findFeedPage: FeedRepository['findFeedPage'] = async ({ lat, lng, radiusInMeters, category, cursor, limit }) => {
    const categoryFragment = category ? Prisma.sql`AND category = ${category}` : Prisma.empty;
    // Row-constructor comparison matches the ORDER BY "createdAt" DESC, id DESC tie-break
    // exactly: any row strictly "after" the cursor in that ordering satisfies this predicate.
    const cursorFragment = cursor
      ? Prisma.sql`AND ("createdAt", id) < (${new Date(cursor.createdAt)}, ${cursor.id})`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<RawFeedPetRow[]>`
      SELECT id, name, species, status, category, reward, "createdAt",
             ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
             ST_Distance(location, ST_MakePoint(${lng}, ${lat})::geography) as "distanceMeters"
      FROM "Pet"
      WHERE ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusInMeters})
      ${categoryFragment}
      ${cursorFragment}
      ORDER BY "createdAt" DESC, id DESC
      LIMIT ${limit + 1};
    `;

    // Fetch one extra row to cheaply determine hasNextPage without a second COUNT query.
    const hasNextPage = rows.length > limit;
    const items = (hasNextPage ? rows.slice(0, limit) : rows).map(mapFeedRowToDomain);
    return { items, hasNextPage };
  };

  return { findFeedPage };
};
