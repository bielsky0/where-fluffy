// Plik ładowany jako *pierwszy* import w main.ts, zanim jakikolwiek moduł aplikacji (express,
// prisma, socket.io, redis) zostanie wymagany — OpenTelemetry patchuje moduły Node.js przy ich
// pierwszym `require`/imporcie, więc rejestracja instrumentacji musi wyprzedzić resztę importów.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { otelConfig } from './shared/config/otel.config.js';

// Both signals ride the same OTLP gRPC endpoint (Alloy's otelcol.receiver.otlp, see
// infra/alloy/config.alloy) — Alloy demuxes by signal type on its side, not by port.
const traceExporter = new OTLPTraceExporter({
  url: otelConfig.OTEL_EXPORTER_OTLP_ENDPOINT,
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({
    url: otelConfig.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  exportIntervalMillis: 15000,
});

// `defaultResource()` niesie standardowe atrybuty SDK (telemetry.sdk.name/version/language) —
// bez zmergowania z nim, `resourceFromAttributes` nadpisałby cały resource, gubiąc je.
const resource = defaultResource().merge(
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]: otelConfig.OTEL_SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    'deployment.environment': otelConfig.NODE_ENV,
  }),
);

export const otelSdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Instrumentacja fs generuje ogromny szum (każdy `readFile`/`stat`) bez wartości dla
      // śledzenia przepływu żądania HTTP -> Prisma/Redis/Socket.io — wyłączona świadomie.
      // HTTP, Redis (node-redis v4+ — działa też na `redis` v6 użytym w tym projekcie) i
      // Socket.io są objęte automatycznie przez ten meta-pakiet (instrumentation-http/
      // instrumentation-redis-4/instrumentation-socket.io).
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
    // Prisma NIE jest objęte przez getNodeAutoInstrumentations — Prisma Client generuje spany
    // samodzielnie przez własny `tracingHelper`, ale trzeba mu jawnie podpiąć tę instrumentację
    // (od Prisma 6.1 tracing jest GA, `previewFeatures = ["tracing"]` w schema.prisma nie jest
    // już wymagane).
    new PrismaInstrumentation(),
  ],
});

otelSdk.start();

export async function shutdownOtel(): Promise<void> {
  await otelSdk.shutdown();
}
