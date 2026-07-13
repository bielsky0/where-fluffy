# 01 — Architektura ogólna

## Co to robi / Jak działa

### Układ repo: sibling directories, nie monorepo-tool

- `src/` — backend (własny `package.json`, tsconfig, node_modules)
- `web/` — frontend React+Vite (własny, niezależny `package.json`)
- `infra/` — sidecar AI (FastAPI), konfiguracja observability (Alloy/Grafana/Tempo/Prometheus), db, Caddy
- `tests/` — smoke test observability + testy obciążeniowe k6
- Puste placeholdery na przyszłość: `shared-types/`, `src/modules/sightings/`, `src/common/`

Nie ma Turborepo/Nx/pnpm workspaces — dwa niezależne pakiety spinane przez Docker Compose.
Świadoma decyzja: przy jednym deweloperze i dwóch pakietach narzędzie monorepo to koszt bez
zysku (brak współdzielonych bibliotek do orkiestrowania; `shared-types/` to zalążek momentu,
w którym by się to zmieniło).

### Layering backendu

Każdy moduł w `src/modules/<name>/` ma ten sam przekrój:

```
*.routes.ts  →  *.controller.ts  →  *.service.ts  →  *.repository.ts (jedyna warstwa z Prismą)
      ↑ validate(schema) z Zod       biznes + mapowanie do DTO
+ dto/  + interface(s)/  + *.schema.ts  + index.ts (composition root)
```

- **Routes**: wiring + walidacja Zod przez middleware `validate(schema)` / `validateQuery(schema)` —
  nie w kontrolerze.
- **Controller**: bierze zwalidowane `req.body`, woła serwis, kształtuje odpowiedź HTTP. Async
  handlery owinięte w `asyncHandler` (Express 5 + odrzucone promise → `error.middleware.ts`).
- **Service**: logika biznesowa, mapowanie wierszy repo na response DTO, rzucanie `AppError`.
- **Repository**: jedyna warstwa dotykająca `prisma` (lub raw SQL).

Moduły: `pets`, `auth`, `chat`, `comments`, `feed`, `map`, `search`, `geocode`, `location`,
`seo`, `health`. Wszystkie trasy agregowane w `app.routes.ts` pod `/api/v1`; gatewaye WS w
`app.gateways.ts`.

Dwa moduły są celowo „zagnieżdżone": **comments** nie ma własnego routes — jego kontroler jest
montowany w `pets.routes.ts` jako `/pets/:petId/comments` (komentarz to zasób podrzędny peta).
Podobnie **feed** jest montowany jako `GET /pets/feed` i `/pets/feed/urgent`.

### FP/closure-DI zamiast klas

Żaden moduł nie używa `class`. Każda warstwa to fabryka domykająca zależności:

```ts
createPetRepository(prisma) → PetRepository
createPetsService(petRepository, photoStorage, geocoding, embeddingQueue) → PetsService
createAuthService(authRepository, passwordHasher, tokenService) → AuthService
```

Kontrakty (`PetRepository`, `PasswordHasher`, `TokenService`, `ChatPresenceStore`…) są typami w
`interface(s)/` — serwis zna tylko interfejs, nie implementację. Kompozycja odbywa się raz, w
`index.ts` modułu (module-level singletons), skąd konsumuje je `*.routes.ts`.

### Bootstrap (`src/main.ts`)

Kolejność jest znacząca:

1. `import 'dotenv/config'` → 2. `import './instrumentation.js'` — **OTel musi być pierwszym
   „świadomym" importem**, żeby auto-instrumentacja zdążyła spatchować `http`/`express`/`pg`
   zanim ktokolwiek je zaimportuje.
2. `createApp()` (Express) → `http.createServer`.
3. `initRedis()` → `locationRepository.init()` (GeoIP MaxMind do pamięci).
4. Duplikacja klienta Redis na `pubClient`/`subClient` → `initSocket(server, pub, sub, redisClient)`
   (adapter Redis + rate limit połączeń + JWT middleware) → `registerAllGateways(io)`.
5. `server.listen`.

### Error handling — jedno źródło prawdy

`shared/errors/app-error.ts`: `AppError = Error & { statusCode; isOperational; code? }` +
`createAppError(...)` + type guard `isAppError`. Bez klasy, bez `any`.

`shared/middleware/error.middleware.ts` — jedyny globalny handler:
- `isAppError(err) && err.isOperational` → status/message z błędu (+ `errors: [...]` dla walidacji),
- wszystko inne → pełny log przez `req.log.error` (pino-http) i generyczne
  `500 Internal server error` — **zero wycieku szczegółów do klienta**.

Historia warta opowiedzenia: wcześniej każdy moduł miał własny lokalny `HttpError` — celowo
zdeduplikowane do jednej implementacji, gdy powtórzenie stało się oczywiste (rule of three).

Wyjątek świadomy: `chat.service.ts` rzuca gołe `Error('FORBIDDEN')` itd. — to błędy WS-only,
konsumowane przez catch w gatewayu i mapowane na event `error_response`. `statusCode` to pojęcie
HTTP, które nie ma sensu w transporcie Socket.io, więc nie udajemy że ma.

### Walidacja — Zod na poziomie trasy

`validate(schema)`: `safeParse(req.body)`, sukces → podmiana `req.body` na sparsowany wynik,
porażka → `next(ValidationAppError)` (400 + `issues`). Kontroler tylko castuje `req.body` do DTO
z komentarzem skąd walidacja pochodzi.

**Gotcha Express 5**: `req.query` jest getter-only — nie da się go podmienić jak `req.body`.
Stąd osobne `validate-query.ts`, które zapisuje wynik do `req.validatedQuery`. To dobry przykład
na „znam różnice Express 4 vs 5".

### Graceful shutdown

`SIGTERM`/`SIGINT` → `server.close()` → w callbacku po kolei: `io.close()` →
`petEmbeddingQueue.close()` + `queueConnection.quit()` → `prisma.$disconnect()` → trzy klienty
Redis (`redisClient`, `pubClient`, `subClient`) → **`shutdownOtel()` na końcu** (żeby spany z
samego shutdownu jeszcze się wyeksportowały) → `process.exit(0)`.

Puenta: zamknięcie samych „Prisma + server" nie wystarczy — każde otwarte połączenie Redis/kolejka
trzyma event loop przy życiu i proces nigdy nie kończy się na SIGTERM (kontener czekałby na
`docker kill` po timeout).

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Dlaczego wybrana |
|---|---|---|
| Express 5 + własne warstwy | NestJS | NestJS daje DI/moduły/pipes, ale za cenę dekoratorów, `reflect-metadata` i magii klas. Fabryki + interfejsy dają te same szwy testowe w ~100 liniach infrastruktury i pełną kontrolę. Na rozmowie: „umiem powiedzieć, co NestJS robi pod spodem, bo zbudowałem to ręcznie". |
| FP/closure-DI | Klasy + constructor injection | Domknięcia dają ten sam efekt bez `this`-binding i bez hierarchii; obiekt z funkcjami jest trywialny do zamockowania literalnie. |
| Zod na trasie | walidacja w kontrolerze / class-validator | Trasa deklaruje cały kontrakt wejścia w jednym miejscu; kontroler dostaje już typowane dane; class-validator wymaga klas i dekoratorów. |
| Jeden `error.middleware` | try/catch per kontroler | Centralizacja = spójny kształt błędów, jedno miejsce logowania, brak wycieków stack trace. |
| Sibling dirs | pnpm workspaces / Nx | Zero współdzielonego kodu dziś; koszt narzędzia > zysk. Punkt przełamania: pierwszy realny pakiet w `shared-types/`. |

## Skalowanie

- API jest **stateless** (sesja w cookie JWT, presence/rate-limit/cache w Redis, WS przez adapter
  Redis) — skalowanie horyzontalne to `docker compose up --scale api=N` za load balancerem;
  nic w architekturze tego nie blokuje.
- Composition roots jako module-level singletons = jedna pula połączeń Prisma i jeden klient
  Redis na proces — przewidywalny koszt per replika.
- Wąskie gardła przy wzroście: pool Postgresa (wtedy realnie wpiąć PgBouncer, który już stoi w
  compose — patrz rozdział 02) i sidecar AI (rozdział 03).

## Słabości + ulepszenia

- `authenticate` middleware zwraca surowe `res.status(401).json(...)` zamiast iść przez
  `createAppError` → niespójność z resztą pipeline'u. Fix: 1 linia.
- `GET /pets/nearby` ma ręczną walidację `parseFloat`/`isNaN` zamiast `validateQuery(zodSchema)` —
  relikt sprzed wprowadzenia `validate-query.ts`.
- Logi bootstrapu przez `console.log` (po polsku), reszta przez pino — do ujednolicenia.
- Brak lint/format configu (ESLint/Prettier) w repo — `tsc --noEmit` jest jedynym gatem jakości
  kodu poza testami.

## Pytania, które mogą tu paść

- „Dlaczego nie NestJS?" → patrz tabela wyżej; kluczowe zdanie: świadomie odtworzyłem 20%
  NestJS, których potrzebowałem, bez 80% magii.
- „Jak testujesz bez frameworka DI?" → kontrakty w interfejsach + fabryki; mock to literal
  object (rozdział 09).
- „Co się dzieje z odrzuconym promise w handlerze?" → `asyncHandler` → `next(err)` →
  `error.middleware`. Niuans do pochwalenia się: Express 5 od wersji stabilnej sam forwarduje
  odrzucone promise do error middleware, więc `asyncHandler` jest tu głównie jawną konwencją
  (i zabezpieczeniem dla `validate()` w łańcuchu) — wiem, że w Express 4 był obowiązkowy.
- „Opowiedz o graceful shutdown" → kolejność + dlaczego OTel na końcu + dlaczego wszystkie
  klienty Redis.
