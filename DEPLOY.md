# Deploy runbook

Pierwsze uruchomienie produkcji dla "Where's Fluffy". Zakłada Docker + Docker Compose na
docelowym hoście i dostęp do repo.

## 1. Prerekwizyty

- DNS: rekord A/AAAA dla domeny (`DOMAIN`) musi już wskazywać na ten host **przed** pierwszym
  `up`. Caddy (`infra/caddy/Caddyfile`) próbuje automatycznie wystawić certyfikat Let's Encrypt
  przy starcie — bez działającego DNS-u ta próba się nie uda.
- Porty 80/443 muszą być wolne na hoście (jedyny publiczny wejściowy kontener to `proxy`/Caddy).

## 2. Konfiguracja

```bash
cp .env.production.example .env.production
```

Wypełnij `.env.production` — pełna lista zmiennych i ich znaczenie jest opisana w komentarzach
tego pliku (sekcje: wymagane / podłączone-opcjonalne / zdefiniowane-ale-niepodłączone).

## 3. Start

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` to nakładka na bazowy `docker-compose.yml` — usuwa hardkodowane
dev-owe dane logowania, chowa wewnętrzne porty i dodaje `proxy` (Caddy, TLS) oraz `web`
(zbudowany frontend, serwowany przez nginx).

## 4. Smoke test

```bash
curl https://<DOMAIN>/api/v1/health
```

Endpoint (`src/modules/health/health.controller.ts`) sprawdza połączenie z Postgresem i Redisem
— `200` gdy oba działają, `503` gdy któreś nie.

Sprawdź też, że żaden kontener nie wpadł w restart-loop:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml ps
```

## 5. Znane ograniczenia (świadomie nienaprawione w tym przebiegu)

- **Traces z przeglądarki nie mają dziś dokąd polecieć w produkcji.** `alloy` jest w
  `docker-compose.prod.yml` całkowicie odpięty od publicznego portu, a `infra/caddy/Caddyfile`
  nie ma trasy do niego — nawet po ustawieniu `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` przeglądarka
  nie ma jak dobić do kolektora. Żeby to naprawić: dodać trasę w Caddyfile (np.
  `handle /otlp/* { reverse_proxy alloy:4318 }`) i ustawić `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`
  odpowiednio. Do tego czasu to znana, nieblokująca funkcja no-op.
- **`NOMINATIM_USER_AGENT`/`PHOTON_USER_AGENT`** mają placeholder z przykładowym mailem jako
  domyślną wartość — ustaw je w `.env.production` na realny kontaktowy adres przed realnym
  ruchem (wymóg polityki użycia obu usług geokodowania).
- **Zmiana `VITE_*` wymaga rebuildu**, nie restartu — Vite zaszywa je w bundlu w momencie
  `docker compose ... build web`.
- **Migracje Prisma nie są uruchamiane automatycznie** przy starcie kontenera `api` — odpal
  ręcznie po pierwszym starcie (i po każdej zmianie schematu). Kontener `api` ma dziś
  `DATABASE_URL` ustawione na PgBouncer (`pgbouncer:6432`) — dla migracji celowo nadpisz ją na
  bezpośrednie połączenie z `db:5432`, bo blokady migracyjne Prisma (advisory locks) są znane z
  problemów pod poolingiem:
  ```bash
  set -a; source .env.production; set +a
  docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml \
    exec -e DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB" \
    api npx prisma migrate deploy
  ```
