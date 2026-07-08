// Plik ładowany jako *pierwszy* import w main.ts, zanim jakikolwiek moduł aplikacji (express,
// prisma, socket.io, redis) zostanie wymagany — OpenTelemetry patchuje moduły Node.js przy ich
// pierwszym `require`/imporcie, więc rejestracja instrumentacji musi wyprzedzić resztę importów.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { otelConfig } from './shared/config/otel.config.js';

const traceExporter = new OTLPTraceExporter({
  url: otelConfig.OTEL_EXPORTER_OTLP_ENDPOINT,
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
  instrumentations: [
    getNodeAutoInstrumentations({
      // Instrumentacja fs generuje ogromny szum (każdy `readFile`/`stat`) bez wartości dla
      // śledzenia przepływu żądania HTTP -> Prisma/Redis/Socket.io — wyłączona świadomie.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

otelSdk.start();

export async function shutdownOtel(): Promise<void> {
  await otelSdk.shutdown();
}
