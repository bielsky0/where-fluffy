# Where's Fluffy — przygotowanie do rozmowy rekrutacyjnej (senior/architect)

Dokument podzielony na rozdziały tematyczne. Każdy rozdział ma stałą strukturę:
**Co to robi / Jak działa** → **Dlaczego tak (alternatywy)** → **Skalowanie** →
**Słabości + ulepszenia** → **Pytania, które mogą tu paść**.

## Spis treści

1. [Architektura ogólna](01-architektura-ogolna.md) — layering, FP/closure-DI, bootstrap, error handling, graceful shutdown
2. [Baza danych i PostGIS](02-baza-danych-postgis.md) — Prisma + raw SQL, geography, keyset pagination, migracje
3. [AI i embeddingi](03-ai-embeddings.md) — pgvector, sidecar FastAPI, BullMQ worker, cross-modal search
4. [Auth i bezpieczeństwo](04-auth-i-bezpieczenstwo.md) — 3 ścieżki logowania, JWT cookie, rate limiting
5. [Realtime chat](05-realtime-chat.md) — Socket.io, Redis adapter, trust boundary
6. [Frontend](06-frontend.md) — dual-query map explorer, TanStack Query, Zustand, offline
7. [Observability](07-observability.md) — OTel, Alloy, Tempo/Loki/Prometheus, korelacja sygnałów
8. [Infra, deploy, CI](08-infra-deploy-ci.md) — compose base+prod, Caddy, CI/CD, Prisma Studio
9. [Testy](09-testy.md) — unit/integration/e2e-WS, testcontainers, k6, pytest sidecara
10. [Słabości i roadmapa](10-slabosci-i-roadmapa.md) — szczera lista problemów z planem naprawy
11. [Pytania i odpowiedzi](11-pytania-i-odpowiedzi.md) — ~40 przewidywanych pytań z gotowymi odpowiedziami

---

## Elevator pitch (30 sekund)

"Where's Fluffy" to aplikacja do zgłaszania zaginionych zwierząt: użytkownik zgłasza zaginięcie
ze zdjęciami i lokalizacją, inni zostawiają geotagowane komentarze-obserwacje, a właściciel i
znalazca mogą otworzyć czat real-time. Wyróżniki techniczne:

- **Geo-search na PostGIS** (GiST, `ST_DWithin`/bbox) z Prismą, gdzie kolumny `geography` idą
  przez raw SQL, bo Prisma ich nie wspiera natywnie.
- **Wyszukiwanie semantyczne cross-modal**: zdjęcia zwierząt → wektory 768-dim (pgvector + HNSW),
  liczone przez self-hosted sidecar FastAPI z dwoma wyrównanymi wieżami nomic v1.5 (vision +
  text) — zapytanie tekstowe znajduje zwierzę po zdjęciu. Pipeline asynchroniczny przez BullMQ
  z osobnym procesem workera.
- **Czat na Socket.io z adapterem Redis** (gotowy do skalowania horyzontalnego) i przemyślaną
  granicą zaufania: autoryzacja SQL raz przy wejściu do pokoju, potem grant w Redis.
- **Pełne observability**: OTel na backendzie i froncie → Alloy → Tempo/Loki/Prometheus, z
  automatyczną korelacją logów i trace'ów (pino `mixin()` wstrzykuje `trace_id`).
- **Frontend**: React + Leaflet, dual-query map explorer (lekkie piny + paginowany feed na tym
  samym bboxie), offline-first mutations przez persist TanStack Query.
- Całość w **funkcyjnym DI bez klas i bez frameworka** — fabryki `createX(deps)` + composition
  roots, co daje pełną testowalność (mocki na kontraktach interfejsów) bez NestJS/InversifyJS.

Stack: Express 5, Prisma 6, Postgres (PostGIS + pgvector), Redis, Socket.io 4, BullMQ, Zod,
FastAPI (Python, inference), React 18 + Vite + TanStack Query 5 + Zustand, Docker Compose,
Caddy, Grafana/Tempo/Loki/Prometheus/Alloy, GitHub Actions.

## Top 10 rzeczy, którymi warto się pochwalić

1. **Cross-modal semantic search** — tekst „rudy kot z białą łatką" znajduje zwierzę wyłącznie po
   zdjęciach, dzięki wspólnej przestrzeni embeddingów nomic text+vision. Świadoma migracja
   z Ollamy (jej API embeddings nie przyjmuje obrazów) na własny sidecar.
2. **Keyset (seek) pagination w feedzie** zamiast OFFSET — stabilna przy równoległych insertach,
   index-friendly, kursor jako base64url `{createdAt, id}` z row-constructor comparison w SQL.
3. **Trust boundary czatu w Redis** — autoryzacja SQL tylko przy `join_chat`, potem `sendMessage`
   sprawdza klucz `access:<userId>:<roomId>` (TTL 1h). Świadomy trade-off wydajność vs okno
   rewokacji — i umiem powiedzieć, jak bym go domknął.
4. **Dual-query map explorer** — mapa dostaje minimalne piny (`{id,lat,lng,status}`, cap 2000),
   szuflada dostaje paginowany pełny DTO; oba keyowane tym samym debounced+rounded bboxem.
   Scroll szuflady nie re-renderuje pinów.
5. **Funkcyjne DI** — zero klas, zero `any`, kontrakty w interfejsach; unit testy podmieniają
   Prisma/bcrypt/Redis czystymi obiektami. Gateway Socket.io testowany bez socketów.
6. **Observability z pełną korelacją** — klik w log w Grafanie prowadzi do trace'a w Tempo
   i odwrotnie; RED metrics generowane przez Tempo z exemplars; do tego smoke test, który
   asertuje przepływ trace→log→metryka end-to-end.
7. **Cztery udokumentowane gotchas Prisma+PostGIS** (SELECT \* na geography wywala
   deserializację; id to TEXT nie uuid; `@updatedAt` jest client-side; excess-property check
   nie łapie złych pól przez typ XOR) — znalezione testami integracyjnymi.
8. **Świadoma degradacja**: `api` nie czeka na `ai-model` w compose — search zwraca 503 zamiast
   blokować start; geocoding nigdy nie rzuca (silent fallback); rate limiter przy awarii Redis
   fail-open.
9. **Prod overlay compose** z `ports: !override []` (odpinanie wszystkich portów), `${VAR:?}`
   fail-fast na sekretach, Caddy jako jedyny publiczny entrypoint z auto-TLS.
10. **Offline-first mutations na froncie** — persist TanStack Query do localStorage jako
    świadomy zamiennik Background Sync API; zgłoszenie zwierzaka złożone offline wychodzi po
    odzyskaniu sieci, nawet po restarcie PWA.

## Jak opowiadać (taktyka na rozmowę)

- Zaczynaj od **problemu produktowego**, potem decyzja, potem trade-off. Np. nie „użyłem
  pgvector", tylko „zgłaszający nie zna rasy — potrzebowałem wyszukiwania po wyglądzie, więc…".
- Przy każdej decyzji miej **odrzuconą alternatywę** (rozdziały mają sekcję „Dlaczego tak").
- Słabości wymieniaj **zanim rekruter je znajdzie** — rozdział 10 to lista z planami naprawy;
  na poziomie senior+ świadomość długu technicznego jest atutem, nie wstydem.
- Gdy nie wiesz — mów, jak byś **zweryfikował** (test, metryka, spike), nie zgaduj.
