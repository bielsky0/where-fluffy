# 02 — Baza danych: Prisma + PostGIS + pgvector

## Co to robi / Jak działa

### Model danych (`src/prisma/schema.prisma`)

- **User** — `email?`/`password?` nullable (bo ghost accounts i OAuth), `isGhost`,
  `provider`/`providerId` (`@@unique([provider, providerId])`), `emailVerified`. Relacje: pets,
  comments, ownerChats/finderChats (nazwane relacje do ChatRoom), messages.
- **Pet** — rdzeń domeny: `species`, `status` (default `missing`), `category`, `reward`,
  `photoUrls String[]` (+ legacy `photoUrl`), `city`, pola seedingu (`isAdminAdded`, `sourceUrl`,
  `originalContact`) oraz dwie kolumny **`Unsupported`**: `location geography(Point, 4326)` i
  `embedding vector(768)`. Indeksy: GiST na `location`, B-tree na `category`, HNSW na `embedding`
  (tylko w raw migration — patrz niżej).
- **Comment** — obserwacja/sighting: `message`, `type`, opcjonalne `location geography`,
  `onDelete: Cascade` do Pet.
- **ChatRoom** — `@@unique([petId, ownerId, finderId])` — jeden pokój na parę właściciel–znalazca
  per zwierzak; **Message** z FK do pokoju i nadawcy.
- **OtpCode** — celowo **odklejony od User** (email + code + expiresAt): w momencie żądania OTP
  konto może jeszcze nie istnieć.

### `Unsupported("geography")` → cały geo-dostęp przez raw SQL

Prisma nie umie czytać/pisać kolumn `geography`, więc repozytoria (`pets.repository.ts`,
`comments.repository.ts`, `feed.repository.ts`, `map.repository.ts`) używają `$queryRaw` z
tagged template (parametryzacja = brak SQL injection):

- zapis: `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`
- odczyt: `ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng` — nigdy sama kolumna
- proximity: `ST_DWithin(location, ST_MakePoint(...)::geography, radius)` + `ORDER BY ST_Distance`
- viewport: `location && ST_MakeEnvelope(minLng, minLat, maxLng, maxLat, 4326)::geography`
  (overlap na indeksie GiST)
- dynamiczne fragmenty przez `Prisma.sql` / `Prisma.empty` / `Prisma.join` (np. `update` składa
  SET tylko z obecnych pól)

### Cztery gotchas znalezione testami integracyjnymi (mocna historia na rozmowę)

1. **Nigdy `SELECT *`/`RETURNING *` na tabeli z `geography`** — `$queryRaw` nie umie
   zdeserializować surowej kolumny i rzuca w runtime. Stąd stała `RETURNING_COLUMNS` z jawną
   listą kolumn.
2. **`id` to `TEXT`, nie natywny `uuid`** — Prismowe `String @id @default(uuid())` zapisuje TEXT;
   cast parametru `::uuid` wywala się, bo Postgres nie ma operatora `text = uuid`.
3. **`@updatedAt` jest funkcją klienta Prisma, nie `DEFAULT` w DB** — raw `INSERT` musi jawnie
   ustawić `"updatedAt" = now()`, inaczej NOT NULL constraint.
4. **Excess-property check TypeScriptu nie łapie nieistniejących pól** przekazanych do
   `prisma.comment.create({ data })` — typ `data` to warunkowy `XOR<CreateInput, UncheckedCreateInput>`,
   przez który check nie odpala. Stary kod pisał `latitude`/`longitude` (pola sprzed migracji na
   `geography`), **przechodził `tsc --noEmit`** i wywalał się dopiero w runtime (`Unknown argument`).
   Wniosek: typy Prisma nie zastępują testu integracyjnego.

### Keyset pagination w feedzie (`feed.repository.ts`)

Zamiast `OFFSET/LIMIT`:

```sql
WHERE status IN ('missing','found')
  AND <ST_DWithin | bbox &&>
  AND ("createdAt", id) < (cursor.createdAt, cursor.id)   -- row-constructor comparison
ORDER BY "createdAt" DESC, id DESC
LIMIT limit + 1;
```

- Kursor = base64url(JSON `{createdAt, id}`) (`feed.cursor.ts`); zepsuty kursor → 400.
- `id` w kluczu sortowania to tie-break dla identycznych timestampów.
- `LIMIT limit + 1` → `hasNextPage` bez drugiego zapytania COUNT.
- Sort po `createdAt`, a nie po odległości — KNN distance-ordering w Postgresie nie ma prostej
  kontynuacji kursorem; `ST_DWithin` filtruje po GiST, a `ST_Distance` jest tylko kolumną w SELECT.
- W trybie bbox `distanceMeters` jest `NULL` — viewport nie ma jednego punktu odniesienia, więc
  DTO ma `distanceMeters: number | null` zamiast zmyślonej liczby.

### CTE w comments (`comments.repository.ts`)

`create` to `WITH inserted AS (INSERT ... RETURNING <jawne kolumny>) SELECT ... JOIN "User"` —
insert + dociągnięcie nazwy autora w **jednym round-tripie**, bez selekcji surowej kolumny
`location`. Fragment lokalizacji budowany warunkowo: `ST_SetSRID(ST_MakePoint(...))::geography`
gdy są współrzędne, inaczej `NULL`.

### PgBouncer — jest, ale nieużywany (świadomie)

`pgbouncer` (edoburu, port 6432, `AUTH_TYPE=scram-sha-256`) stoi w compose, ale `DATABASE_URL`
celuje bezpośrednio w `db:5432`. Powód: przy 1–2 replikach API pool Prismy wystarcza, a PgBouncer
w trybie transaction-pooling ma pułapki (prepared statements → Prisma wymaga
`pgbouncer=true` w URL). Punkt przełamania: N replik API × pool size > `max_connections`
Postgresa — wtedy przepinam URL na 6432 i to jest zmiana konfiguracyjna, nie kodowa. Deploy
w CI już dziś robi `prisma migrate deploy` **bezpośrednio do db**, z pominięciem bouncera —
migracje i tak wymagają session mode.

### Migracje (11, w tym 3 „ręczne")

Historia pokazuje ewolucję: `init` (jeszcze `latitude`/`longitude` DOUBLE) →
**`add_postgis_location`** (raw: `CREATE EXTENSION postgis`, drop lat/lng, `geography` + GiST) →
kolumny produktowe → ghost accounts/OTP → **`backfill_pet_photo_urls`** (raw data migration:
`UPDATE ... SET "photoUrls" = ARRAY["photoUrl"]`) → OAuth →
**`add_pet_embedding_vector`** (raw: `CREATE EXTENSION vector` + `vector(768)` + HNSW
`vector_cosine_ops`) → pola seedingu (z drop+recreate indeksu HNSW — patrz rozdział 03).

W `schema.prisma` `extensions = [postgis]` **bez** `vector` — celowo: zadeklarowanie `vector`
sprawiało, że `db push` w testcontainers (obraz bare-postgis per moduł) próbował
`CREATE EXTENSION vector` i wywalał suity, które wektora w ogóle nie dotykają.

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| PostGIS w Postgresie | osobny geo-store (Elasticsearch geo, Redis GEO) | Jedna baza = transakcyjność z resztą domeny, brak synchronizacji dwóch źródeł prawdy; GiST + `ST_DWithin` w zupełności wystarcza na tę skalę. |
| Prisma + raw SQL na geo | Knex/Kysely/drizzle wszędzie, albo czysty `pg` | Prisma daje typowany klient i migracje dla 95% modelu; raw SQL tylko tam, gdzie musi. Trade-off jest realny (gotchas wyżej) i umiem go nazwać. |
| Keyset pagination | OFFSET/LIMIT | OFFSET skanuje i odrzuca wiersze (koszt rośnie liniowo ze stroną) i duplikuje/gubi elementy przy równoległych insertach; keyset jest O(log n) po indeksie i stabilny. |
| Kursor base64url `{createdAt,id}` | numeryczne strony, opaque token w Redis | Bezstanowy, samoopisujący, nie wymaga storage; klient traktuje jako opaque string. |
| CTE insert+join | dwa zapytania | Jeden round-trip; przy okazji omija problem selekcji `geography`. |

## Skalowanie

- **Odczyty geo**: GiST skaluje dobrze; przy wzroście — najpierw `EXPLAIN ANALYZE` i ewentualnie
  indeks częściowy (`WHERE status IN ('missing','found')`), potem read-repliki (feed/map/pins to
  czyste odczyty, łatwe do wydzielenia na replikę).
- **Połączenia**: wpięcie istniejącego PgBouncera (transaction mode) gdy repliki API pomnożą pool.
- **Hot rows / COUNT**: `map/stats` już jest cache'owane w Redis; feed nie robi COUNT wcale
  (limit+1).
- **Partycjonowanie** (po czasie lub regionie) dopiero przy dziesiątkach milionów wierszy — nie
  wcześniej, bo komplikuje indeksy geo.

## Słabości + ulepszenia

- Ręczne mapowanie wierszy raw SQL → domena jest powtarzalne i podatne na literówki kolumn;
  przy większej liczbie geo-modeli wydzieliłbym mały helper budujący listę kolumn + mapper.
- Stały komentarz w schemacie przy `Comment.location` („warto zamienić na PostGIS") jest
  nieaktualny — już jest PostGIS.
- Brak indeksu częściowego pod najczęstszy filtr `status IN ('missing','found')`.
- `prisma.ts` to goły `new PrismaClient()` — bez konfiguracji logowania slow queries; dodałbym
  `log: [{emit:'event', level:'query'}]` + próg czasu w pino.

## Pytania, które mogą tu paść

- „Dlaczego geography, a nie geometry?" → `geography` liczy po elipsoidzie (metry na całym
  globie, poprawne `ST_DWithin` w metrach bez reprojekcji); `geometry` byłaby szybsza, ale
  wymagałaby lokalnego układu współrzędnych — dla aplikacji ogólnokrajowej geography jest
  poprawniejsza i wystarczająco szybka z GiST.
- „Jak działa twój kursor przy dwóch wierszach z tym samym createdAt?" → tie-break po `id`
  w ORDER BY i w row-constructor comparison; bez tego paginacja gubi/duplikuje wiersze —
  złapane realnym flakiem w testach (rozdział 09).
- „Co jeśli ktoś poda zmanipulowany kursor?" → to tylko `{createdAt,id}` — najwyżej dostanie
  inną stronę publicznych danych; malformed → 400. Kursor nie niesie uprawnień.
- „Czemu nie ORM-owe relacje do wszystkiego?" → tam gdzie Prisma umie (chat, auth) — używam
  klienta; raw SQL wyłącznie tam, gdzie typ kolumny ją wyklucza.
