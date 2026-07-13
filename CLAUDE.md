# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Where's Fluffy" — a backend for a lost-pet-reporting app. Users report missing pets with a
location, other users leave location-tagged comments/sightings, and an owner/finder pair can
open a real-time chat once a sighting is confirmed.

The backend lives under `src/` (its own `package.json`, node_modules, tsconfig); the frontend
(React + Vite + Leaflet + TanStack Query) lives under `web/`, with its own independent
`package.json`/node_modules — the two aren't wired together by a monorepo tool, they're sibling
directories. `tests/` (observability smoke tests, k6 load tests) and `infra/` (Alloy/Grafana/
Tempo/Prometheus observability config) also have real content. Only `shared-types/` and
`src/modules/sightings/`/`src/common/` are still empty placeholders for future work — don't
assume code exists there.

## Commands

Run everything from `src/` (that's where `package.json` lives):

```bash
cd src
npm install
npm run dev            # tsx watch main.ts — starts the API + WS server
```

Infra (Postgres+PostGIS, PgBouncer, Redis, Jaeger) via Docker Compose from repo root:

```bash
docker compose up -d
```

Prisma (run from `src/`):

```bash
npx prisma migrate dev     # apply/create migrations
npx prisma generate        # regenerate client after schema changes
```

The `pets`, `auth`, `chat`, and `comments` modules have a Jest test suite (`src/jest.config.js`):

```bash
npm run test:unit          # *.spec.ts except *.integration.spec.ts — no Docker needed
npm run test:integration   # *.repository.integration.spec.ts — spins up real postgis/postgis:16-3.4
                            # containers via testcontainers; needs Docker
npm test                   # both
```

Controller specs (e.g. `auth.controller.spec.ts`) build a throwaway Express app in-file — only the
module's own routes mounted on real `*.controller.ts`/`*.service.ts` factories wired to mocked
repository/hasher/token dependencies — and drive it with `supertest`, rather than importing the
real `app.ts` (which would transitively pull in every other module's composition root). Any file
matching `*.integration.spec.ts` is excluded from `test:unit` and included in `test:integration`
— keep that suffix for any new real-DB test.

`chat.gateway.spec.ts` tests `createChatGateway` without a real Socket.io server or sockets: it
builds minimal hand-typed mocks for exactly the `io`/`socket` methods the gateway actually calls
(`on`/`to`/`emit`/`join`/`disconnect`/`id`/`data`, not the full Socket.io API surface), registers
the gateway against them, then pulls the registered event handlers straight out of the mocks'
`.mock.calls` (via a small typed `getRegisteredHandler` helper — Jest's own `mock.calls` type is
untyped, so this helper re-attaches a concrete signature rather than letting it leak as `any`) and
invokes them directly to simulate `connection`/`join_chat`/`send_message`/`disconnect`. This is the
pattern to follow for any future WS gateway test — no real socket connection is needed to verify
the trigger → service → `io.to(room).emit(...)` flow.

Jest specs are transpiled by ts-jest in isolated CommonJS mode (see `jest.config.js`), independent
of the app's own NodeNext ESM build — `npx tsc --noEmit` remains the authoritative type-check
gate, not `jest` itself. `tsconfig.json`'s `types` is explicitly `["node", "jest"]` so ambient
Jest globals (`describe`/`it`/`expect`) type-check without polluting resolution for the app's
other `@types/*` packages. All four real modules (`pets`, `auth`, `chat`, `comments`) now have a
test suite; `src/modules/sightings/` remains an empty placeholder (see Project section above). No
lint/format config is present in the repo.

`comments.repository.integration.spec.ts` seeds its FK dependencies (`User`, `Pet`) via plain
`prisma.user.create()`/`prisma.pet.create()` rather than through `pets.repository.ts` — only
`Comment.location` is under test there, so `Pet.location` is left `NULL` (harmless, since nothing
in these tests reads it). Its createdAt-ordering test inserts a deliberate `setTimeout(5ms)`
between two sequential `create()` calls: without it, the two inserts can land on the same
microsecond timestamp under load (observed flaking specifically when all four modules'
`*.integration.spec.ts` containers start concurrently via `npm test`), making `ORDER BY
"createdAt" DESC` non-deterministic between them.

## Architecture

**Stack**: Express 5, Prisma 6 (Postgres + PostGIS), Socket.io 4 (with Redis adapter for
horizontal scaling), Redis (`redis` v6 client), Zod for validation, JWT auth via httpOnly cookie,
pino for logging.

**Bootstrap flow** (`src/main.ts`): connect Redis → duplicate the client into pub/sub clients for
the Socket.io Redis adapter → create the HTTP server from `app.ts` → init Socket.io
(`shared/infrastructure/socket.ts`) → register WS gateways (`app.gateways.ts`) → listen.

**Module layout**: each feature under `src/modules/<name>/` follows the same layering —
`*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts` (Prisma calls), plus
`dto/` and `interface(s)/` subfolders for request/response shapes and domain types. Zod schemas
from `*.schema.ts` are applied at the route level via `validate(schema)` (see **Validation**
below), not inside the controller; controllers call the service and shape the HTTP response;
services contain business logic and map repository rows to response DTOs; repositories are the
only layer that touches `prisma`.

The **comments** module is a partial exception: it has no `comments.routes.ts`. Its controller
(`createCommentsController`, exposing `create`/`listForPet`) is composed in `comments/index.ts`
and imported directly into `pets.routes.ts`, mounted at `/pets/:petId/comments` — comments are
routed as a nested resource under pets, not as a top-level module. `pets.routes.ts`'s
`POST /:petId/comments` is wired to `commentsController.create` with `validate(createCommentSchema)`
ahead of it, so comment creation is reachable over HTTP. (This was a one-line routing bug for a
while — the route used to call `petsController.create` instead, and the schema validation
middleware was missing too; both are fixed now.)

Every module (`pets`, `auth`, `chat`, `comments`) follows the same FP/closure-DI shape: each
`*.repository.ts`/`*.service.ts`/`*.controller.ts` exports a `createX(...)` factory that closes
over its dependencies (e.g. `createPetRepository(prisma)` / `createPetsService(petRepository)`, or
`createAuthRepository(prisma)` / `createAuthService(authRepository, passwordHasher, tokenService)`,
or `createChatRepository(prisma)` / `createChatService(chatRepository, chatPresenceStore)`, or
`createCommentsRepository(prisma)` / `createCommentsService(commentsRepository, petRepository)`),
composed once as module-level singletons in the module's own `index.ts` and consumed from there
by `*.routes.ts`. No module uses `class`. The injectable contracts (`PetRepository` in
`pets/interfaces/pets.interface.ts`; `AuthRepository`/`PasswordHasher`/`TokenService` in
`auth/interface/auth.interface.ts`; `ChatRepository`/`ChatPresenceStore` in
`chat/interface/chat.interface.ts`; `CommentsRepository` in
`comments/interfaces/comment.interface.ts`) are what let each module's `*.service.spec.ts`
unit-test business logic against hand-rolled mocks instead of a real
`PrismaClient`/`bcrypt`/`jsonwebtoken`/Redis client. `auth.repository.ts`'s `create` also
translates a duplicate-email unique-constraint violation (Prisma code `P2002`) into a plain
`Error(EMAIL_ALREADY_EXISTS_ERROR)` rather than leaking `PrismaClientKnownRequestError` upward;
`auth.service.ts`'s `register` catches that specifically as a race-condition fallback behind its
own proactive `findByEmail` check. `comments.service.ts` reuses `PetRepository` (injected as a
second constructor argument, imported from `pets/index.ts`'s exported `petsRepository` at the
composition root — not Prisma directly) to check pet existence before creating a comment.

**Map explorer is a dual-query architecture, not one endpoint feeding both a map and a list**:
`src/modules/map/` (new top-level module, `GET /api/v1/map/pins`) returns a deliberately minimal
flat array (`{id, lat, lng, status}`, no pagination, capped at a hardcoded `PINS_LIMIT`) filtered
by a `bbox=minLng,minLat,maxLng,maxLat` query param — this feeds `web/`'s Leaflet map/marker
clustering only. `GET /pets/feed` (existing `feed` module) additionally accepts that same `bbox`
as an *alternative* to its original `lat`/`lng`/`radius` proximity mode (mutually exclusive,
enforced by `feedQuerySchema`'s `.refine()` — existing proximity-mode callers are untouched) and
feeds the map explorer's paginated results drawer with the full DTO instead. Both query schemas
share one `bboxSchema` fragment (`src/shared/schemas/bbox.schema.ts`) for parsing/range-checking.
In bbox mode, `feed.repository.ts` filters via `location && ST_MakeEnvelope(...)::geography`
(GiST-indexed bbox overlap) instead of `ST_DWithin`, and `distanceMeters` comes back `null` (a
bbox has no single reference point for `ST_Distance` to measure from) — `FeedPetResponseDTO`'s
`distanceMeters` is `number | null` for this reason. On the frontend, `web/src/modules/map/api/useMapPins.ts`
and `web/src/modules/feed/api/useFeedInfiniteBbox.ts` are separate TanStack Query hooks (not one
hook feeding both `MapView` and `PetResultsList`) — `MapExplorerPage.tsx` derives a debounced
(350ms, see `useDebouncedCallback`), rounded (`roundBbox`, ~5 decimal places) bbox from Leaflet's
`moveend` event and keys both hooks' `queryKey`s on it. `PetResultsList.tsx`'s
`@tanstack/react-virtual` windowing targets `BottomSheet.tsx`'s own content div (via a shared
`contentRef`), not a nested scroll container of its own — that div already owns custom
scroll-position-driven drag/overscroll-handoff logic (`handleContentScroll`), so a second nested
`overflow-y-auto` div would silently break it (the outer element's `scrollTop` would never move).

**Chat's gateway is composed outside `chat/index.ts`**: every other module builds its full stack
(repository → service → controller) eagerly at import time in its own `index.ts`, but
`createChatGateway(io, chatService, rateLimitEvents)` needs a live `Server` instance that only
exists once `shared/infrastructure/socket.ts`'s `initSocket()` runs inside `main.ts`'s
`bootstrap()` — well after module imports resolve. So `chat/index.ts` composes everything
*except* the gateway (`chatRepository`, `chatPresenceStore`, `chatService`, `chatController`), and
`app.gateways.ts` is where `createChatGateway` actually gets called, importing `chatService` from
`chat/index.ts`, building the injected per-user event rate limiter (see **Rate limiting** below),
and receiving `io` as its own parameter. Socket event payload/emit types
(`ClientToServerEvents`/`ServerToClientEvents`/`SocketData`, composed into `ChatIoServer`/
`ChatIoSocket`) live in `chat/interface/chat.interface.ts` and are imported by both
`app.gateways.ts` and `shared/infrastructure/socket.ts` (a `shared/` → `modules/chat/` dependency,
acceptable for now since chat is the only WS module — see the comment in `socket.ts` for what to
do if a second one is added).

All HTTP routes are aggregated in `app.routes.ts` under the `/api/v1` prefix. All WS gateways are
registered in `app.gateways.ts`.

**Auth**: JWT is issued in `auth.service.ts` and expected in an httpOnly cookie named `token`.
It's verified independently in two places that must be kept in sync: `shared/middleware/auth.middleware.ts`
for HTTP requests, and the `io.use(...)` middleware in `shared/infrastructure/socket.ts` for WS
connections (parsed from `socket.request.headers.cookie`). Both read `JWT_SECRET` from env with
the same hardcoded fallback (`'super-secret-key-change-me'`) — only `DATABASE_URL` is currently
set in `.env`.

**PostGIS location fields**: `Pet.location` and `Comment.location` are declared in
`schema.prisma` as `Unsupported("geography(Point, 4326)")`, so the Prisma client can't read or
write them directly. All reads/writes for these models go through `prisma.$queryRaw` with
`ST_MakePoint`/`ST_SetSRID`/`ST_X`/`ST_Y`/`ST_DWithin`/`ST_Distance` (see `pets.repository.ts`).
When adding fields to these models, follow the existing raw-SQL + manual row-mapping pattern
rather than relying on the generated Prisma client for the geo column. Three gotchas discovered
(and fixed in `pets.repository.ts`) while building its integration test suite, worth remembering
for any new raw SQL against these models: (1) never `SELECT *`/`RETURNING *` on a table with a
`geography` column — Prisma's `$queryRaw` can't deserialize the raw column and throws at
runtime, so list columns explicitly and only add computed `ST_Y`/`ST_X` aliases; (2) `id` columns
(Prisma `String @id @default(uuid())`) are stored as Postgres `TEXT`, not native `uuid` — don't
cast comparison params with `::uuid`, Postgres has no `text = uuid` operator; (3) `@updatedAt` in
`schema.prisma` is a Prisma-client-level feature, not a DB `DEFAULT` — raw `INSERT`s must set
`"updatedAt"` explicitly (e.g. `now()`) or they fail a `NOT NULL` constraint. A fourth, found later
in `comments.repository.ts`: passing fields that don't exist on the model (e.g. the old code wrote
`latitude`/`longitude` directly into `prisma.comment.create({ data: {...} })`, left over from
before `Comment.location` became a `geography` column) can silently **pass `tsc --noEmit`** —
Prisma's generated `data` argument type is `XOR<CommentCreateInput, CommentUncheckedCreateInput>`,
and TypeScript's excess-property check doesn't reliably fire through that conditional-type shape —
but always fails at runtime with `Unknown argument`. If a raw-SQL rewrite of one of these
models suddenly becomes necessary, that's a signal the standard Prisma Client call was already
broken and untested, not a regression you're introducing. `comments.repository.ts` now writes
`location` via a conditionally-built `Prisma.sql` fragment (`ST_SetSRID(ST_MakePoint(...))::geography`
when both `latitude`/`longitude` are present, else `NULL`), composed inside a `WITH inserted AS
(INSERT ... RETURNING ...)` CTE so the `INSERT ... RETURNING` and the `SELECT ... JOIN "User"`
(for the author's name) happen in one round trip without ever selecting the raw `location` column.

**Vector AI & Embedding Pipeline (vision-only)**: `Pet.embedding` (`vector(768)`, pgvector, HNSW
index hand-written in a raw migration) is computed **exclusively from pet photos** — the first
5 entries of `photoUrls` (fallback: single `photoUrl`); text fields (`name`/`species`/
`distinguishingMarks`) do NOT feed the vector, and a pet with no photos gets its embedding
cleared to `NULL` (`PetRepository.clearEmbedding`), never a stale one. The model server is a
self-hosted FastAPI sidecar (`infra/ai-model/`, Compose service `ai-model`, port 8000) serving
both aligned nomic v1.5 towers: `POST /embed/image` (nomic-embed-vision-v1.5; downloads the
Cloudinary URLs itself with aggressive timeouts, embeds each, mean-pools + L2-normalizes into
ONE vector) and `POST /embed/text` (nomic-embed-text-v1.5, `search_query: ` prefix added
server-side) for the `search` module's query-time embedding — the shared 768-dim space is what
makes a text query match photo vectors cross-modally. It **replaced Ollama** (whose embeddings
API can't take images); don't reintroduce an `EMBEDDING_MODEL` env var, the model is the
sidecar's own concern. All vector math (pooling, L2 norm) lives only in
`infra/ai-model/vector_math.py` — Node never does vector arithmetic; the sidecar's own pytest
suite (run during `docker build`, its only CI gate) pins the `||v|| == 1` contract. The sidecar
runs a single Uvicorn process with an internal inference semaphore to stay under its 2G Compose
memory limit — do not "scale" it with Gunicorn workers (each would duplicate both models in
RAM). Write path: `pets.service.ts` enqueues `EMBED_PET_DATA` (BullMQ) on create and on
photo-set changes only; `ai-worker` (second entrypoint of the `src/` image) consumes it via
`embed-pet-data.processor.ts`. `EmbeddingProvider` (`shared/embedding/`) exposes
`generateEmbedding(text)` + `generateImageEmbedding(urls)`; the `fake` provider (dev/CI default)
hashes inputs deterministically so the whole pipeline runs without the sidecar.
`src/scripts/backfill-embeddings.ts` re-enqueues every pet through the normal worker pipeline
(used once for the text→vision migration; reusable after any embedding-affecting change).

**Chat access control (Redis as the trust boundary)**: `chat.service.ts`'s `joinChatRoom` checks
Postgres only once, when a socket sends `join_chat` — it verifies the user is the pet's owner or
the given finder (via the injected `ChatRepository`), creates/reuses a `ChatRoom` row, then
caches that grant in Redis (`access:<userId>:<roomId>`, 1h TTL) via the injected
`ChatPresenceStore`'s `grantUserAccess`. Every subsequent `sendMessage` only checks the Redis key
(`checkUserAccess`), not the database — a failed check throws `Error('FORBIDDEN')`, which
`chat.gateway.ts` catches and maps to the `error_response` event. `ChatRepository` (Prisma,
`chat.repository.ts`) and `ChatPresenceStore` (Redis, `chat.presence.ts`) are deliberately
separate injectable contracts, composed together only inside `createChatService`; the gateway
itself never talks to Prisma or Redis directly. Any change to room-membership rules must update
both the SQL check and the Redis grant/check pair, both inside `chat.service.ts`'s `joinChatRoom`/
`sendMessage`.

**Error handling**: centralized as of this writing — this supersedes an earlier convention (each
module duplicating its own local `HttpError`/`createHttpError`) that was previously documented
here as deliberate; it has been replaced app-wide by a single shared implementation, not layered
on top of it. `shared/errors/app-error.ts` exports `AppError` (`Error & { statusCode: number;
isOperational: boolean }`), `createAppError(statusCode, message, isOperational = true)`, and the
`isAppError` type guard — no `class`, no `any`. Every module that needs to throw an HTTP error
(`auth.service.ts`, `comments.service.ts`) imports `createAppError` directly instead of
hand-rolling its own; `pets.service.ts` doesn't throw any today, and `chat.service.ts`'s plain
`Error('PET_NOT_FOUND'|'UNAUTHORIZED'|'FORBIDDEN')` is deliberately **not** `AppError` — those are
WS-only, consumed by `chat.gateway.ts`'s own catch logic for the `error_response` Socket.io event,
never touch `error.middleware.ts`, and `statusCode`/`isOperational` are HTTP-response concepts
that don't apply to that transport.

`shared/middleware/error.middleware.ts` is the single global error handler: `isAppError(err) &&
err.isOperational` → respond with that error's own `statusCode`/`message` (plus `errors: [...]`
for validation errors, see below); anything else (a non-`AppError`, or an `AppError` explicitly
marked `isOperational: false`) → full error logged via `req.log.error(...)` (pino-http, wired in
`app.ts`), generic `500 { status: 'error', message: 'Internal server error' }` to the client, no
internal detail leaked. A raw `ZodError` reaching the handler directly (bypassing `validate()`,
see below) is still normalized the same way, as a defensive fallback, not the primary path.

**Validation**: `shared/middleware/validate.ts` exports `validate(schema: ZodType<T>)`, a route-level
Express middleware — `schema.safeParse(req.body)`, and on failure calls `next()` with a
`ValidationAppError` (`AppError & { details: ZodError['issues'] }`, `statusCode: 400`, `message:
'Validation failed'`) instead of throwing directly; on success it replaces `req.body` with the
parsed/typed result and calls `next()`. Controllers no longer call `xSchema.parse(req.body)`
inline — validation is wired at the route (`router.post('/register', validate(registerSchema),
asyncHandler(authController.registerUser))`, see `auth.routes.ts`/`pets.routes.ts`), and the
controller method just casts `req.body` to the already-validated DTO type with a comment noting
where the validation happened, since Express's `Request['body']` stays untyped either way. Async
route handlers must still be wrapped in `shared/utils/asyncHandler.ts` to forward rejections
(from either the controller or `validate()` itself) to `error.middleware.ts`.

**Graceful shutdown**: `main.ts`'s `bootstrap()` registers `SIGTERM`/`SIGINT` handlers that call
`server.close()`, then inside its callback close, in order, Socket.io (`io.close()`), Prisma
(`prisma.$disconnect()`), and all three Redis connections (`redisClient`, plus the adapter's
`pubClient`/`subClient`) before `process.exit(0)`. All three Redis clients and Socket.io are
closed even though the strict ask was "Prisma + server instance" — leaving any of them open would
keep the process alive past `server.close()`'s callback, so the process would never actually exit
on SIGTERM/SIGINT in this app.

**Rate limiting** (`shared/rate-limit/`, `rate-limiter-flexible` + Redis): all four limiter
instances in the app — HTTP global, HTTP per-route, WS connection, WS event — are backed by
`RateLimiterRedis` and reuse the **same general-purpose `redisClient`** exported from
`shared/infrastructure/redis.ts` (the one `chat.presence.ts` already uses), never the adapter's
`pubClient`/`subClient`. This is a hard requirement, not a style choice: in node-redis v4+, a
client that has entered pub/sub subscriber mode (as `pubClient`/`subClient` do, for
`@socket.io/redis-adapter`) can no longer run arbitrary commands (`EVAL`/`MULTI`, which
`rate-limiter-flexible` needs) — only `redisClient` is safe to reuse this way. Because it's the
same client `main.ts`'s graceful shutdown already calls `redisClient.quit()` on, the rate
limiters need no shutdown code of their own — they open no connections beyond the one already
managed. `RateLimiterRedis` also requires `useRedisPackage: true` explicitly in its constructor
options: it only auto-detects `ioredis` (by checking `client.constructor.name === 'Commander'`),
not node-redis, so without this flag it silently uses the wrong command-dispatch path.

- **HTTP** (`shared/rate-limit/rate-limiter.middleware.ts`): `createRateLimiterMiddleware(redisClient,
  options, resolveKey?)` — FP factory, no `class`, returns an Express middleware. Keys by `req.ip`
  by default (`resolveKey` is overridable, e.g. to key by `req.user!.id` on authenticated routes).
  On limit breach, sets a `Retry-After` header and calls `next(createAppError(429, ...))`, so it
  flows through the normal `error.middleware.ts` path. Wired twice: a loose global limit
  (`100 req/60s`, `keyPrefix: 'rl:http:global'`) mounted in `app.ts` ahead of `apiRouter`, covering
  all of `/api/v1`; and a stricter one (`5 req/60s`, `blockDuration: 300s`,
  `keyPrefix: 'rl:http:auth-login'`) mounted only on `POST /auth/login` in `auth.routes.ts`,
  ahead of `validate(loginSchema)` — the same factory, different options, demonstrating the
  pattern for any other sensitive route. `options: any` — the type given in the original
  ask — was deliberately not used; it's `RateLimiterOptions` (`keyPrefix`/`points`/`duration`/
  `blockDuration`) instead, to satisfy this repo's zero-`any` bar.
- **Socket.io** (`shared/rate-limit/rate-limiter.socket.ts`), two distinct layers, because
  `io.use()` and `socket.use()` solve different problems and are easy to conflate:
  - `createSocketConnectionRateLimiter(redisClient, options)` → registered via `io.use(...)` in
    `shared/infrastructure/socket.ts`, **before** the JWT `io.use(...)` middleware — keys by
    `socket.handshake.address` (IP), so it throttles connection *attempts* cheaply before any
    auth work happens. `points: 5, duration: 10, blockDuration: 60`. Calling `next(err)` here
    rejects the handshake outright (Socket.io's built-in behavior for `io.use()`).
  - `createSocketEventRateLimiter(redisClient, options)` → returns a per-user middleware factory,
    consumed via `socket.use(rateLimitEvents(userId))` inside `chat.gateway.ts`'s `connection`
    handler, throttling all incoming events (`join_chat`/`send_message`) for that already-
    authenticated socket. `points: 20, duration: 10`, configured in `app.gateways.ts` and injected
    into `createChatGateway` as its third parameter — the gateway itself stays agnostic of
    Redis/rate-limiter-flexible, consistent with how `chat.service.ts` stays agnostic of Prisma
    via `ChatRepository`. **Non-obvious Socket.io behavior**: unlike `io.use()`, `next(err)` inside
    a `socket.use()` middleware does **not** disconnect the socket — it only emits a local
    `'error'` event on that socket (Socket.io's own documented pattern for this). `chat.gateway.ts`
    must listen for it explicitly (`socket.on('error', (err) => socket.emit('error_response', {
    message: err.message }))`) or a throttled event is silently swallowed with no client feedback.
  - Both use `AppError`/`createAppError(429, ...)` as the error carrier passed to `next()`, per
    the requirement — but `statusCode` is informational only here: Socket.io has no HTTP status
    concept, so `429` never actually reaches the client as a protocol-level code, only as
    `err.message` on `connect_error` (`io.use()`) or the local `'error'` event (`socket.use()`).

**Docker Compose services**: `db` (postgis/postgis, port 5432), `pgbouncer` (port 6432, not
currently referenced by `DATABASE_URL`), `redis` (port 6379), `jaeger` (OTLP on 4317, UI on
16686 — tracing is not yet wired into the app code), plus the embedding pipeline pair:
`ai-model` (the FastAPI embedding sidecar described above, internal port 8000, 2G memory limit)
and `ai-worker` (BullMQ consumer — second entrypoint of the same `src/` image as `api`, only the
`command:` differs; its `depends_on` waits for `ai-model` to be healthy, while `api` deliberately
does not, so semantic search degrades to 503 instead of blocking api startup).

**Prisma Studio (DB admin GUI)**: `prisma-studio` service, gated behind the `admin` Compose
profile — it does **not** start on a bare `docker compose up -d`. Start on demand:
`docker compose --profile admin up -d prisma-studio`; stop it when done:
`docker compose --profile admin down prisma-studio`. Prisma Studio has **no built-in
authentication** — its port is bound to `127.0.0.1:5555` only (not `0.0.0.0`, unlike every other
service's ports in this file), so the SSH tunnel is the entire auth boundary: anyone who can SSH
to the host gets full unrestricted DB read/write through it. Requires `DATABASE_URL` set in the
root `.env` first — the container exits immediately with a clear error if it's unset (checked at
container start, not at `docker compose config` time, so a missing `DATABASE_URL` never breaks
the base `docker compose up -d` for everyone else). Remote access: `ssh -L
5555:localhost:5555 user@server`, then browse `http://localhost:5555` locally; close the tunnel
and tear the container down again once finished.

## Conventions

- Code comments and some error messages are written in Polish; match the existing style within a
  file rather than switching languages mid-file.
- All local imports use explicit `.js` extensions (NodeNext ESM module resolution).
