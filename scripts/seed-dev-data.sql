-- Dev-only sample data: one test user, two sample lost pets, two sample sightings.
--
-- IMPORTANT — this file is deliberately NOT under init-scripts/, and must stay that way:
--
-- Postgres's official image runs every *.sql/*.sh file under /docker-entrypoint-initdb.d
-- exactly once, the very first time a container starts against an EMPTY data volume — before
-- this repo's `api` service (and therefore before `npx prisma migrate dev`/`deploy`) has ever
-- run. This script only INSERTs into "User"/"Pet"/"Comment" — the tables Prisma's migrations
-- create — so on a genuinely fresh volume those tables don't exist yet and this script fails
-- with "relation does not exist", which aborts the whole init sequence (Postgres's entrypoint
-- runs init scripts with ON_ERROR_STOP, so this one failing also skips any *.sql files that
-- would otherwise run after it alphabetically). This previously lived at
-- init-scripts/02-seed-dev-data.sql, auto-mounted (as the whole directory) into
-- /docker-entrypoint-initdb.d by docker-compose.yml's `db` service — which crashed `db` on
-- first boot in production (fresh volume, migrations not run yet) and, worse, would have
-- auto-inserted a publicly-known dev login (dev@example.com / password123) into a live
-- database on any run where it didn't hit that race. It was moved to scripts/ specifically so
-- it never runs automatically, in dev or prod — only ever by explicit invocation below.
--
-- Reliable way to apply this seed data on a fresh environment:
--   1. docker compose up -d db
--   2. cd src && npx prisma migrate dev        (creates "User"/"Pet"/"Comment"/... for real)
--   3. docker compose exec -T db psql -U user -d fluffy_db < ../scripts/seed-dev-data.sql
--
-- Table/column names below are Prisma's actual generated schema (quoted, mixed-case — see
-- src/prisma/schema.prisma), not the lowercase `users`/`pets`/`sightings` this was originally
-- described as. Seeding separate lowercase tables would be invisible to the app entirely:
-- every repository (pets.repository.ts, comments.repository.ts, auth.repository.ts) reads and
-- writes "User"/"Pet"/"Comment" exclusively, via raw SQL against those exact quoted names.

-- Dev test account — email: dev@example.com / password: password123
-- Hash generated with this repo's own installed `bcrypt` package at saltRounds=10 (see
-- src/modules/auth/auth.hasher.ts), so auth.service.ts's bcrypt.compare() genuinely accepts
-- it — not a placeholder hash copied from elsewhere.
INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt")
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'dev@example.com',
  '$2b$10$QBRxKGmIVYLnE6cq.bsu2eFlqq0NJuSjx6gNpw93yr.lhHAoZ.n0q',
  'Dev User',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Sample lost pets. "status" must be the literal string 'missing', not schema.prisma's
-- @default("LOST") annotation — that default is dead code in practice: pets.repository.ts's
-- `save()` always writes 'missing' explicitly via raw SQL (bypassing Prisma Client's own
-- column defaulting), and `findNearLocation()` hard-filters `WHERE status = 'missing'` — any
-- other value, including the schema's own documented default, makes a pet permanently
-- invisible to GET /pets/nearby.
INSERT INTO "Pet" (id, name, species, status, reward, location, "ownerId", "createdAt", "updatedAt")
VALUES
  (
    'b0000000-0000-4000-8000-000000000001',
    'Fluffy',
    'Cat',
    'missing',
    50,
    ST_SetSRID(ST_MakePoint(21.0122, 52.2297), 4326)::geography,
    'a0000000-0000-4000-8000-000000000001',
    now(),
    now()
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'Rex',
    'Dog',
    'missing',
    100,
    ST_SetSRID(ST_MakePoint(21.0222, 52.2350), 4326)::geography,
    'a0000000-0000-4000-8000-000000000001',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- Sample sightings — these are "Comment" rows (see CLAUDE.md's "sighting points" note);
-- comments.repository.ts is what actually reads/writes this table. One has a location
-- (type: 'sighted', GPS required by createCommentSchema's refine), one doesn't
-- (type: 'area_checked_empty', no GPS required).
INSERT INTO "Comment" (id, message, type, "petId", "userId", location, "createdAt", "updatedAt")
VALUES
  (
    'c0000000-0000-4000-8000-000000000001',
    'Saw a cat matching this description near the market square.',
    'sighted',
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    ST_SetSRID(ST_MakePoint(21.0130, 52.2301), 4326)::geography,
    now(),
    now()
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'Checked the park, no sign of the dog.',
    'area_checked_empty',
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    NULL,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;
