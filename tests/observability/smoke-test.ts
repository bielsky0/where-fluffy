// End-to-end smoke test for the observability stack (infra/, docker-compose.yml).
//
// Unlike shared/infrastructure/logger.spec.ts (fast, no Docker, exercises the mixin() logic in
// isolation), this script verifies the REAL pipeline: a real HTTP request against the
// containerized app really produces a trace in Tempo, a correlated log line in Loki, and a
// metric datapoint in Prometheus — exercising Alloy's Docker log scraping, OTLP receiver, and
// remote_write bridge exactly as they run in production.
//
// Prerequisites: `docker compose up -d --build api` (or the whole stack) already running —
// this script does not manage container lifecycle itself, it only probes already-running
// services and fails fast with a clear message if something isn't up.
//
// Usage: npx tsx tests/observability/smoke-test.ts
//        (from src/: npm run test:observability)

const APP_URL = process.env.SMOKE_APP_URL ?? 'http://localhost:3000';
const TEMPO_URL = process.env.SMOKE_TEMPO_URL ?? 'http://localhost:3200';
const LOKI_URL = process.env.SMOKE_LOKI_URL ?? 'http://localhost:3100';
const PROM_URL = process.env.SMOKE_PROM_URL ?? 'http://localhost:9090';
const APP_CONTAINER = process.env.SMOKE_APP_CONTAINER ?? 'where-fluffy-api-1';
const SERVICE_NAME = process.env.SMOKE_SERVICE_NAME ?? 'where-fluffy-api';

type CheckResult = { ok: boolean; detail: string };

const nsTimestamp = (ms: number): string => `${Math.floor(ms * 1e6)}`;

async function waitFor(
  label: string,
  check: () => Promise<CheckResult>,
  { timeoutMs, intervalMs = 1000 }: { timeoutMs: number; intervalMs?: number },
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastDetail = '';

  while (Date.now() < deadline) {
    const result = await check().catch((err: Error) => ({ ok: false, detail: err.message }));
    lastDetail = result.detail;
    if (result.ok) {
      console.log(`  \x1b[32m✓\x1b[0m ${label} — ${result.detail}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.log(`  \x1b[31m✗\x1b[0m ${label} — timed out after ${timeoutMs}ms. Last: ${lastDetail}`);
  throw new Error(`${label} failed`);
}

async function checkReady(name: string, url: string): Promise<void> {
  await waitFor(`${name} is ready`, async () => {
    const res = await fetch(url);
    return { ok: res.ok, detail: `GET ${url} -> ${res.status}` };
  }, { timeoutMs: 30000, intervalMs: 2000 });
}

// Returns the freshest RAW sample timestamp (seconds since epoch) across all series matching
// the metric, looking back `lookbackSeconds`. Deliberately uses a range-vector selector
// (`metric{...}[Ns]`) via the *instant* query endpoint rather than either a plain instant query
// or /api/v1/query_range: both of those return a value for every point on a synthetic time
// grid via lookback-and-hold extrapolation, so their timestamps are always "now" regardless of
// whether anything actually changed — useless for freshness checks. A range-vector selector
// returns the actual raw ingested samples (confirmed empirically: they land ~15s apart here,
// matching instrumentation.ts's exportIntervalMillis, not a synthetic per-step grid), so its
// timestamps genuinely reflect when Prometheus last received new data for that series.
async function getPrometheusLatestSampleTime(query: string, lookbackSeconds = 120): Promise<number> {
  const rangeQuery = `${query}[${lookbackSeconds}s]`;
  const res = await fetch(`${PROM_URL}/api/v1/query?query=${encodeURIComponent(rangeQuery)}`);
  const json = (await res.json()) as { data?: { result?: Array<{ values: Array<[number, string]> }> } };
  const results = json.data?.result ?? [];
  return results.reduce(
    (latest, series) => Math.max(latest, ...series.values.map(([ts]) => ts)),
    0,
  );
}

async function main(): Promise<void> {
  console.log('Observability smoke test\n');
  console.log(`  App:        ${APP_URL} (container: ${APP_CONTAINER})`);
  console.log(`  Tempo:      ${TEMPO_URL}`);
  console.log(`  Loki:       ${LOKI_URL}`);
  console.log(`  Prometheus: ${PROM_URL}\n`);

  console.log('1. Waiting for services to be ready...');
  await checkReady('Tempo', `${TEMPO_URL}/ready`);
  await checkReady('Loki', `${LOKI_URL}/ready`);
  await checkReady('Prometheus', `${PROM_URL}/-/ready`);
  await waitFor('App', async () => {
    const res = await fetch(`${APP_URL}/api/v1/pets/nearby?lat=0&lng=0`);
    // Any HTTP response (even a 4xx) proves the process is up and routing requests — that's
    // all "ready" means here, this endpoint's actual status code isn't the thing under test.
    return { ok: res.status > 0, detail: `GET /api/v1/pets/nearby -> ${res.status}` };
  }, { timeoutMs: 30000, intervalMs: 2000 });

  const startTimeMs = Date.now();

  console.log('\n2. Firing a marker request (GET /api/v1/pets/nearby)...');
  const markerRes = await fetch(`${APP_URL}/api/v1/pets/nearby?lat=52.2297&lng=21.0122`);
  console.log(`  -> ${markerRes.status}`);
  if (!markerRes.ok) {
    throw new Error(`Marker request failed with status ${markerRes.status}, aborting`);
  }

  console.log('\n3. Verifying the trace reached Tempo...');
  await waitFor('Tempo has a fresh trace for this service', async () => {
    const res = await fetch(`${TEMPO_URL}/api/search?tags=&limit=20`);
    const json = (await res.json()) as {
      traces?: Array<{ rootServiceName?: string; startTimeUnixNano: string; traceID: string }>;
    };
    const fresh = (json.traces ?? []).find(
      (t) => t.rootServiceName === SERVICE_NAME && Number(t.startTimeUnixNano) >= Number(nsTimestamp(startTimeMs)),
    );
    return { ok: !!fresh, detail: fresh ? `traceID=${fresh.traceID}` : `${json.traces?.length ?? 0} traces seen, none fresh enough` };
  }, { timeoutMs: 20000, intervalMs: 2000 });

  console.log('\n4. Verifying a correlated log line reached Loki...');
  await waitFor('Loki has a log line for the marker request', async () => {
    const url = new URL(`${LOKI_URL}/loki/api/v1/query_range`);
    url.searchParams.set('query', `{container="${APP_CONTAINER}"} |= "pets/nearby"`);
    url.searchParams.set('start', nsTimestamp(startTimeMs));
    url.searchParams.set('end', nsTimestamp(Date.now()));
    url.searchParams.set('limit', '10');

    const res = await fetch(url);
    const json = (await res.json()) as { data?: { result?: Array<{ values: [string, string][] }> } };
    const lineCount = (json.data?.result ?? []).reduce((sum, r) => sum + r.values.length, 0);
    return { ok: lineCount > 0, detail: `${lineCount} matching log line(s)` };
  }, { timeoutMs: 30000, intervalMs: 2000 });

  console.log('\n5. Verifying the metric reached Prometheus (allow for the 15s OTLP export interval)...');
  await waitFor('Prometheus has a fresh http_server_duration_milliseconds_count sample', async () => {
    const latest = await getPrometheusLatestSampleTime(
      `http_server_duration_milliseconds_count{job="${SERVICE_NAME}"}`,
    );
    const ok = latest * 1000 >= startTimeMs;
    return { ok, detail: ok ? `sample at ${new Date(latest * 1000).toISOString()}` : `latest sample predates the marker request (${latest})` };
  }, { timeoutMs: 40000, intervalMs: 3000 });

  console.log('\n\x1b[32mAll checks passed — traces, logs, and metrics are flowing end-to-end.\x1b[0m');
}

main().catch((err: Error) => {
  console.error(`\n\x1b[31mSmoke test failed:\x1b[0m ${err.message}`);
  console.error('\nIs the stack up? Try: docker compose up -d --build api');
  process.exit(1);
});
