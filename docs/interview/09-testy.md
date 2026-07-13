# 09 — Testy

## Co to robi / Jak działa

### Piramida w tym projekcie

| Poziom | Co | Narzędzia | Kiedy |
|---|---|---|---|
| Unit | `*.service.spec.ts`, `*.controller.spec.ts`, gateway, procesor workera | Jest + ts-jest, ręczne mocki na kontraktach | `npm run test:unit`, bez Dockera |
| Integracja | `*.repository.integration.spec.ts` | testcontainers + prawdziwy Postgres (obraz `where-fluffy/postgres-ai:16`) | `npm run test:integration`, wymaga Dockera |
| Sidecar AI | pytest (`test_vector_math.py`, `test_api.py`) | pytest + fake models | odpalane w `docker build` sidecara |
| Load | k6 HTTP + k6 WebSocket | k6 v0.54+ (natywny TS) | ręcznie, na działającym stacku |
| Observability | smoke test trace→log→metryka | tsx script | `npm run test:observability` |

Konwencja nazewnicza jest kontraktem: sufiks `*.integration.spec.ts` decyduje o przynależności
do suity (unit je wyklucza, integration włącza).

### Unit testy — DI spłaca się tutaj

Serwisy testowane przeciwko ręcznym mockom kontraktów (`PetRepository`, `PasswordHasher`,
`TokenService`, `ChatPresenceStore`) — bez PrismaClient, bcrypt, jsonwebtoken czy Redis w
testach. Mock to zwykły obiekt literalny z `jest.fn()` — konsekwencja fabryk i interfejsów
z rozdziału 01.

**Controller specs**: budują **jednorazową aplikację Express w pliku testu** — montują tylko
trasy testowanego modułu na prawdziwych fabrykach controller/service, z zamockowanym
repo/hasherem — i strzelają supertestem. Celowo NIE importują `app.ts`: prawdziwa aplikacja
transitywnie ciągnie composition rooty wszystkich modułów (a te — Prismę, Redis itd.).
Test dostaje prawdziwy routing+walidację+error handling, ale zero infrastruktury.

**Gateway spec** (`chat.gateway.spec.ts`): bez serwera Socket.io — mocki dokładnie tych metod
`io`/`socket`, których gateway używa; zarejestrowane handlery wyciągane z `mock.calls` przez
typowany helper `getRegisteredHandler` (Jestowe `mock.calls` jest praktycznie `any` — helper
przywraca konkretną sygnaturę) i wywoływane wprost, symulując
`connection`/`join_chat`/`send_message`/`disconnect`. Weryfikuje pełny łańcuch
event → serwis → `io.to(room).emit(...)`.

### Testy integracyjne — prawdziwa baza, bo raw SQL

Repozytoria geo/vector używają raw SQL, którego **nie da się sensownie zamockować** — mock
potwierdziłby tylko, że SQL został wysłany, nie że jest poprawny. Testcontainers podnosi
prawdziwy Postgres (obraz z postgis+pgvector — ten sam co runtime), test odpala migracje
i uderza w realną bazę. To właśnie te testy znalazły wszystkie 4 gotchas Prisma+PostGIS
(rozdział 02).

Detale warte opowiedzenia:
- `comments.repository.integration.spec.ts` seeduje FK (`User`, `Pet`) czystą Prismą, nie przez
  `pets.repository` — testuje tylko `Comment.location`, więc `Pet.location` zostaje NULL
  (nieszkodliwe, nic go nie czyta). Minimalizacja zależności między modułami nawet w testach.
- **Historia flaky testu**: test sortowania po `createdAt` wstawiał dwa wiersze tak szybko, że
  pod obciążeniem (cztery suity kontenerów startujące równolegle przy `npm test`) lądowały na
  **tym samym mikrosekundowym timestampie** — `ORDER BY "createdAt" DESC` stawał się
  niedeterministyczny. Fix: celowy `setTimeout(5ms)` między insertami + (w produkcyjnym SQL)
  tie-break po `id`. Dobra odpowiedź na „opowiedz o flaky teście, który debugowałeś".
- CI buduje obraz postgres-ai lokalnie przed suitą integracyjną (nie ma registry).

### Dwa reżimy TypeScriptu — świadoma decyzja

Aplikacja: NodeNext **ESM** (importy z `.js`). Jest: ts-jest w **izolowanym trybie CommonJS**
(`isolatedModules: true`, `moduleNameMapper` zdejmuje `.js` z importów). Konsekwencja:
**Jest nie jest type-checkiem** — autorytatywną bramką typów jest `tsc --noEmit` (osobny krok
CI). Testy transpilują się szybko, typy pilnowane są tam, gdzie trzeba. ESM w Jest to wciąż
bagno — obejście przez CJS to pragmatyzm, nie ignorancja, i umiem to nazwać.

### Pytest sidecara w `docker build`

Suita sidecara (12 testów: matematyka wektorowa + API z fake'owymi modelami, bez sieci)
odpala się **podczas builda obrazu** — nieprzechodzące testy = obraz się nie zbuduje = deploy
niemożliwy. Sprytne minimum: katalog Pythona nie potrzebuje własnego joba CI. Testy przypinają
kontrakty: `||v|| == 1`, prefix `search_query: `, cap 5 URL-i, oversize → 422.

### k6 (`tests/perf/k6/`)

- `load-test.ts` — HTTP: `POST /pets/:id/comments`, rampa 0→50→50→0 VU w 2 min, progi
  **p95 < 200 ms, błędy < 1%, checki > 99%**. Tylko 5 userów round-robin — bo login jest
  rate-limitowany 5/60s/IP (test szanuje własny rate limiter).
- `ws-load-test.ts` — Socket.io: connect → `join_chat` → `send_message` → echo; własne
  countery (`chat_joined_total`, `message_echoed_total`), 5 par owner/finder.

### Czego celowo NIE ma

- Testów E2E przeglądarkowych (Playwright) i testów `web/` w ogóle — największa luka, nazwana
  w rozdziale 10.
- Mockowania Prismy w testach repozytoriów — patrz wyżej, byłoby testowaniem własnych mocków.

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| testcontainers | SQLite / prisma mock / współdzielona baza dev | SQLite nie ma PostGIS; mock nie testuje SQL; współdzielona baza = testy zależne od stanu. Kontener per suita = izolacja i wierność. |
| throwaway app w controller testach | import app.ts / E2E | Pełna warstwa HTTP bez kosztu infrastruktury; E2E zostawione k6/smoke na prawdziwym stacku. |
| ts-jest CJS isolated | jest ESM / vitest | Jest ESM eksperymentalny; vitest byłby dziś naturalnym wyborem greenfield — świadomie zostałem przy Jest, bo działa, a typy pilnuje tsc. |
| pytest w docker build | osobny job CI dla Pythona | Zero dodatkowej konfiguracji, gwarancja „obraz = przetestowany". Trade-off: dłuższy build. |

## Pytania, które mogą tu paść

- „Jak testujesz kod z raw SQL?" → tylko integracyjnie, na prawdziwym silniku z tymi samymi
  rozszerzeniami; unit mock nic by nie dowodził.
- „Opowiedz o flaky teście" → historia mikrosekundowego timestampu wyżej — z diagnozą (load
  równoległych kontenerów), fixem i wnioskiem systemowym (tie-break w ORDER BY).
- „Dlaczego Jest nie type-checkuje twoich testów?" → isolatedModules; bramką jest tsc --noEmit —
  świadoma separacja szybkości od poprawności.
- „Jaki masz coverage?" → nie mierzę procenta; mierzę pokrycie ryzyka: raw SQL — integracyjnie,
  logika — unit, transport WS — gateway spec, wydajność — k6, observability — smoke. Braki
  umiem wskazać (web/).
