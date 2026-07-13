# 08 — Infra, deploy, CI/CD

## Co to robi / Jak działa

### Docker Compose: plik bazowy + prod overlay

**Baza (`docker-compose.yml`)** — 13 serwisów na jednej sieci `fluffy-net`: `db` (własny obraz
`where-fluffy/postgres-ai:16` = postgis + pgvector), `pgbouncer`, `redis`, `api`, `ai-model`
(sidecar, limit **2G RAM / 2 CPU**, healthcheck `curl /health`), `ai-worker` (drugi entrypoint
obrazu api, limit 1G, `depends_on ai-model: service_healthy`), `prisma-studio` (profil `admin`),
oraz stack observability: `alloy`, `loki`, `tempo`, `prometheus`, `grafana` (host port 3001).

Trzy decyzje warte opowiedzenia:

1. **`api` celowo NIE czeka na `ai-model`** — bez sidecara search degraduje do 503, reszta
   działa; `ai-worker` czeka, bo bez modelu jest bezużyteczny. Dependency graph koduje politykę
   degradacji.
2. **Własny obraz `db`** z jawnym tagiem — po to, żeby **testcontainers w CI odwoływały się do
   tego samego obrazu** co runtime (postgis+pgvector w jednym).
3. **`prisma-studio` za profilem** (`docker compose --profile admin up -d prisma-studio`) i
   zbindowany na `127.0.0.1:5555` — Studio nie ma żadnego auth, więc granicą dostępu jest
   **tunel SSH** (`ssh -L 5555:localhost:5555 user@server`). Jedyny serwis bez `0.0.0.0`.

**Prod overlay (`docker-compose.prod.yml`)** — nakładka, nie duplikat:
- **`ports: !override []`** na każdym serwisie — Compose domyślnie *sumuje* listy portów przy
  merge'u, więc bez tagu `!override` porty z bazy zostałyby opublikowane; overlay odpina
  wszystko i tylko `proxy` wystawia 80/443. Niszowy, ale ważny detal Compose.
- **`${VAR:?}` fail-fast** dla wszystkich sekretów — kontener nie wstanie z pustym JWT_SECRET.
- Dodaje `web` (nginx ze statycznym buildem Vite) i `proxy` (**Caddy**), healthcheck dla api,
  Grafana przypięta do `127.0.0.1:3001`, OAuth domyślnie wyłączony.

### Caddy — jedyny publiczny entrypoint (`infra/caddy/Caddyfile`)

- Automatyczny **Let's Encrypt** dla `{$DOMAIN}` (zero konfiguracji certów — główny powód wyboru
  Caddy nad nginx na krawędzi).
- Routing: `/api/v1/*` i `/socket.io/*` → `api:3000`; `/v1/traces` → `alloy:4318` (OTLP z
  przeglądarki); wszystko inne → `web:80`.
- **`web/nginx.conf` świadomie NIE proxuje niczego** — tylko SPA: `try_files $uri $uri/
  /index.html` (fallback dla React Routera) + `/assets/` z `expires 1y, immutable` (hashowane
  pliki Vite; `index.html` zawsze rewalidowany). Uzasadnienie: proxy w dwóch miejscach = dwa
  dryfujące configi; routing to praca Caddy'ego.

### Obrazy

- `src/Dockerfile` — multi-stage node:22-alpine: builder (prisma generate + tsc) → runtime
  (`npm ci --omit=dev` + skopiowane `dist` i klient Prisma). Jeden obraz, dwa entrypointy
  (api / ai-worker) różniące się `command:`.
- `web/Dockerfile` — builder (Vite, `VITE_*` jako build args, bo wartości są inline'owane w
  bundle w czasie builda — to nie są runtime env!) → `nginx:1.27-alpine`.
- `infra/ai-model/Dockerfile` — python:3.12-slim, CPU-only torch, **`pytest -q` odpalany w
  trakcie builda** (build się nie uda, jeśli testy sidecara nie przejdą — jedyny gate CI dla
  tego katalogu), wagi modeli **wpieczone w obraz** (`download_models.py`, `HF_HOME`) — start
  kontenera nie zależy od HuggingFace.

### CI/CD (`.github/workflows/ci.yml`)

Trigger: push na `main`/`dev`, PR do `main`. Joby:
- **backend**: `npm ci` → `prisma generate` (z placeholderowym DATABASE_URL — generate nie
  potrzebuje bazy) → `tsc --noEmit` (autorytatywny type-check) → `test:unit` → **lokalny build
  obrazu `where-fluffy/postgres-ai:16`** → `test:integration` (testcontainers na tym obrazie)
  → build.
- **frontend**: build Vite.
- **deploy** (tylko push na `main`): SSH na serwer (appleboy/ssh-action) → `git pull` →
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` →
  `prisma migrate deploy` **bezpośrednio do `db:5432`** (nie przez pgbouncer — migracje
  wymagają session mode / advisory locks).

Model wdrożenia: build na serwerze docelowym (git pull + compose build). Prosty i wystarczający
dla single-host; świadomie NIE jest to registry + immutable artifacts — patrz Słabości.

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| Compose na jednym hoście | Kubernetes | Skala nie uzasadnia K8s: 1 host, kilkanaście kontenerów; compose + overlay daje 90% wartości przy 5% złożoności. Umiem wskazać punkt przełamania: potrzeba autoscalingu / multi-node / zero-downtime deploy. |
| Caddy na krawędzi | nginx / Traefik | Auto-TLS bez certbota i bez wolumenów na certy; Caddyfile na ten routing to ~20 linii. Traefik ma sens przy dynamicznych usługach — tu topologia jest statyczna. |
| overlay prod | osobny docker-compose.prod.yml od zera | Nakładka = brak dryfu między środowiskami; różnice prod są jawne i policzalne (porty, sekrety, proxy). |
| build na serwerze | registry (GHCR) + pull | Mniej ruchomych części na start; trade-off: brak rollbacku do poprzedniego obrazu i build obciąża serwer prod — pierwsza rzecz do zmiany przy dojrzewaniu (patrz Słabości). |
| wagi modeli w obrazie | download przy starcie | Deterministyczny start, brak zależności od dostępności HF w runtime; koszt: duży obraz — akceptowalny. |

## Skalowanie

- Pojedynczy host to świadomy wybór etapu; ścieżka wzrostu: registry + `docker compose pull`
  na wielu hostach za LB → dopiero potem orkiestrator. Aplikacja jest na to gotowa (stateless
  API, Redis adapter dla WS, współdzielony Redis/Postgres).
- `db`/`redis` na tym samym hoście — pierwszy krok przy wzroście to wyniesienie stanu na
  zarządzane usługi (RDS-like, managed Redis).

## Słabości + ulepszenia

- **Brak root `.env.example`** — baza compose wymaga `${JWT_SECRET:?}` itd., świeży klon nie
  wstanie bez zgadywania zmiennych. README/POLISH to odnotowują; fix trywialny.
- **Deploy bez rollbacku** — git pull + build na serwerze; awaria builda = przestój. Fix: GHCR,
  tagowane obrazy, `compose pull && up -d`, rollback = poprzedni tag.
- Baza compose ma hardcoded credentials (`user`/`password`, grafana admin/admin) i brak
  healthchecków/restart policy poza AI — OK dla dev, naprawione w overlay, ale warto nazwać.
- Brak skanowania obrazów (trivy) i sekretów (gitleaks) w CI.
- `migrate deploy` po `up -d` = krótkie okno, w którym nowy kod działa na starym schemacie —
  przy większej skali: migracje expand/contract i gate przed przełączeniem ruchu.

## Pytania, które mogą tu paść

- „Dlaczego nie Kubernetes?" → dopasowanie narzędzia do skali + nazwany punkt przełamania.
- „Jak wygląda ścieżka requestu w prod?" → Caddy (TLS) → `/api/v1` do api / static do nginx →
  api → Postgres/Redis; WS: Caddy → `/socket.io` → api (adapter Redis między replikami).
- „Zero-downtime deploy?" → dziś brak (single host, up -d --build); plan: healthcheck+rolling
  za LB albo blue-green na poziomie projektów compose.
- „Czemu VITE_* to build args, a nie env?" → Vite inline'uje je w bundle w czasie builda;
  runtime env nie istnieje dla statycznych plików.
- „Jak chronisz narzędzia administracyjne?" → Prisma Studio: profil + loopback + SSH tunnel
  jako cała granica auth; Grafana w prod tylko na loopbacku.
