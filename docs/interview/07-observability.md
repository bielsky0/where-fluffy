# 07 — Observability (OTel → Alloy → Tempo/Loki/Prometheus/Grafana)

> Uwaga do faktów: **aktualny stack tracingu to Tempo**. CLAUDE.md miejscami wciąż wspomina
> Jaegera — to relikt wczesnej wersji (Jaeger został zastąpiony całym stackiem Grafany);
> POLISH.md ma to odnotowane do posprzątania. Na rozmowie mówić „Tempo".

## Co to robi / Jak działa

### Trzy sygnały, jeden kolektor

```
api / ai-worker (Node, OTel SDK) ──OTLP gRPC──▶
web (przeglądarka, OTel web SDK) ─OTLP HTTP──▶  Alloy ──▶ Tempo (traces)
logi kontenerów (docker discovery) ──────────▶        ──▶ Loki (logs)
                                                      ──▶ Prometheus (metrics, remote_write)
                                                              ▲
                                       Tempo metrics_generator (RED + service graph)
```

**Grafana Alloy** to jedyny punkt zbiorczy (zastąpił EOL-owanego Promtaila po stronie logów):
- OTLP receiver (4317 gRPC / 4318 HTTP) → batch → trace'y do Tempo, metryki mostkowane do
  Prometheusa przez `remote_write`;
- logi: `discovery.docker` + `loki.source.docker` (relabeling nazwy kontenera) → Loki.

Aplikacja **pushuje** metryki (OTLP → Alloy → remote_write), Prometheus nie scrape'uje appki —
scrape'uje tylko sam siebie, Alloya i Tempo. `--web.enable-remote-write-receiver` włączony.

### Backend: `src/instrumentation.ts`

- `NodeSDK` z `getNodeAutoInstrumentations` (**fs wyłączone** — szum) + jawna
  `PrismaInstrumentation` (nie jest w auto-instrumentacjach) → spany na zapytaniach do DB.
- OTLP **gRPC** exportery dla traces i metrics na jeden `OTEL_EXPORTER_OTLP_ENDPOINT` (Alloy);
  `PeriodicExportingMetricReader` co 15 s.
- Resource: service name/version + `deployment.environment`.
- **Musi być pierwszym importem w `main.ts`** — auto-instrumentacja patchuje moduły w chwili
  importu; jeśli `express`/`http` załadują się wcześniej, spany nie powstaną. To klasyczne
  pytanie-pułapka o OTel w Node.
- `shutdownOtel()` wywoływany **jako ostatni** w graceful shutdown — żeby spany z samego
  zamykania jeszcze się wyeksportowały.

### Korelacja logów z trace'ami — bez żadnego plumbingu w kodzie

`shared/infrastructure/logger.ts` (pino) ma **`mixin()`**, który przy każdym logu odczytuje
aktywny span z kontekstu OTel i dokleja `trace_id`/`span_id`. Nazwy pól celowo pasują do
derived-field regexa Loki w prowizji Grafany. Efekt: `logger.warn(...)` w dowolnym miejscu
serwisu jest automatycznie skorelowany z requestem/eventem WS, w którym powstał — zero
przekazywania trace id przez parametry.

Do tego redakcja (`cookie`, `authorization`, `password`, `token`, `set-cookie`) — sekrety nie
trafiają do Loki.

### Frontend tracing (`web/src/lib/telemetry.ts`)

- `WebTracerProvider` + OTLP **HTTP** (4318 — przeglądarki nie mówią gRPC), instrumentacje
  Fetch + DocumentLoad, `ZoneContextManager` (zone.js) do utrzymania kontekstu przez async.
- Nagłówki trace propagowane **tylko do własnych URL-i API** — nie wyciekamy trace headers do
  tile serwerów/objectów zewnętrznych (i nie psujemy im CORS).
- Efekt: jeden trace od kliknięcia w przeglądarce, przez Express, po zapytanie Prisma.
- W prod Caddy routuje `/v1/traces` z przeglądarki do Alloya (4318) — browser nie potrzebuje
  osobnego origin.

### Tempo metrics_generator + prowizja Grafany

- Tempo generuje z trace'ów **RED metrics** (rate/errors/duration) i **service graph**, z
  `send_exemplars: true` — punkty na wykresie latencji linkują do konkretnych trace'ów.
- Datasources w prowizji spinają wszystko w obie strony: Loki derived field
  (`"trace_id":"([0-9a-f]+)"`) → Tempo; Tempo `tracesToLogsV2` + `tracesToMetrics` (rate + p95);
  Prometheus `exemplarTraceIdDestinations` → Tempo. Czyli: log → trace → logi tego trace'a →
  metryki tego endpointu → z powrotem do przykładowego trace'a.

### Smoke test observability (`tests/observability/smoke-test.ts`)

Odpalany na działającym stacku (`npm run test:observability`): czeka na `/ready`
Tempo/Loki/Prometheusa, strzela `GET /api/v1/pets/nearby` i asertuje **cały łańcuch**:
1. świeży trace z `rootServiceName=where-fluffy-api` w Tempo (`/api/search`),
2. skorelowana linia w Loki (`{container="where-fluffy-api-1"} |= "pets/nearby"`),
3. świeża próbka `http_server_duration_milliseconds_count` w Prometheus — **selektorem
   range-vector**, żeby pokonać lookback-and-hold (instant query zwróciłby starą próbkę i test
   kłamałby, że pipeline żyje).

To odpowiedź na pytanie „skąd wiesz, że twoje observability działa?" — bo mam na to test.

## Dlaczego tak (alternatywy)

| Decyzja | Alternatywa | Uzasadnienie |
|---|---|---|
| OTel (vendor-neutral) | APM SaaS (Datadog/New Relic), sentry-only | Standard branżowy; instrumentacja w kodzie nie zna backendu — Tempo można wymienić na dowolny OTLP-compatible bez zmiany appki. Zero kosztów licencji. |
| Alloy jako jedyny kolektor | exportery bezpośrednio do Tempo/Loki/Prometheusa | Jeden punkt konfiguracji batchowania/retry/relabelingu; appka zna jeden endpoint; łatwe dodanie tail-samplingu w jednym miejscu. |
| Tempo zamiast Jaegera | Jaeger (pierwotnie w projekcie) | Tempo integruje się natywnie z Grafaną/Loki (traces↔logs↔metrics w jednym UI) i generuje RED metrics z trace'ów; Jaeger to tylko trace'y. Świadoma migracja. |
| push metryk (OTLP) | scrape /metrics | Jeden protokół dla wszystkich sygnałów, brak wystawiania portu metryk na każdej replice; trade-off: Prometheus „pull model" puryści się skrzywią — świadomie. |
| pino + mixin | ręczne przekazywanie trace id / winston | mixin czyta kontekst OTel automatycznie; pino jest najszybszym loggerem w ekosystemie. |

## Skalowanie

- Alloy batchuje i buforuje — repliki appki nie zmieniają architektury.
- Następny krok przy wzroście wolumenu: **tail-based sampling** w Alloy (trzymaj 100% błędów
  i wolnych trace'ów, sampluj resztę), retencja/kompakcja w Tempo/Loki, object storage zamiast
  lokalnych wolumenów.

## Słabości + ulepszenia

- **Zero dashboardów Grafany** — datasources w pełni spięte, ale provider list pusty (celowo,
  żeby uciszyć warning bootowy). Pierwszy dashboard do zrobienia: RED per endpoint z
  metrics_generatora + panel logów błędów. Uczciwie: eksploracja działa (Explore), brakuje
  utrwalonych widoków.
- **Brak alertingu** — mam sygnały, nie mam reguł (np. `rate(errors) > x`, brak próbek z
  ai-workera). To naturalny następny krok przed „prawdziwą" produkcją.
- Stale wzmianki o Jaegerze w CLAUDE.md — dokumentacja do zsynchronizowania.
- Frontend: sampling 100% — przy realnym ruchu ustawiłbym sampler.

## Pytania, które mogą tu paść

- „Jak debugujesz wolny request na produkcji?" → Grafana Explore → Tempo (trace z waterfallem:
  Express → Prisma spany) → tracesToLogs pokazuje logi tego trace'a → tracesToMetrics pokazuje,
  czy to incydent czy wzorzec; exemplars prowadzą z wykresu p95 do konkretnego trace'a.
- „Dlaczego instrumentation.ts musi być pierwszy?" → monkey-patching w momencie importu.
- „Push czy pull dla metryk i dlaczego?" → tu push przez OTLP/Alloy — patrz tabela.
- „Jak logi trafiają do Loki bez agenta w appce?" → appka loguje na stdout (12-factor); Alloy
  zbiera przez docker discovery — appka nie zna Loki w ogóle.
