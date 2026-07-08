// Imported once, as the very first line of main.tsx, before React/router/anything else mounts —
// mirrors src/instrumentation.ts's role on the backend: instrumentations must be registered
// before the code they patch (fetch, document load) runs.
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// NOTE: Alloy's OTLP receiver listens on both 4317 (gRPC) and 4318 (HTTP), same port mapping
// as docker-compose.yml's `alloy` service — but a browser can only speak OTLP/HTTP (no gRPC),
// so this must target 4318/v1/traces, not the backend's 4317 gRPC endpoint. Override via
// VITE_OTEL_EXPORTER_OTLP_ENDPOINT for prod (points at wherever Alloy is reachable publicly).
const OTLP_TRACES_ENDPOINT =
  import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces';

const resource = defaultResource().merge(
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'where-fluffy-web',
    [ATTR_SERVICE_VERSION]: '0.0.1',
    'deployment.environment': import.meta.env.MODE,
  }),
);

const provider = new WebTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: OTLP_TRACES_ENDPOINT }))],
});

// ZoneContextManager (zone.js) keeps span context attached across async boundaries (promise
// chains inside fetch calls, setTimeout, etc.) — without it, nested spans lose their parent
// once execution crosses an await, and every span comes out as a root span in Tempo.
provider.register({ contextManager: new ZoneContextManager() });

registerInstrumentations({
  instrumentations: [
    new DocumentLoadInstrumentation(),
    new FetchInstrumentation({
      // Only trace calls to our own API — otherwise every third-party fetch (fonts, CDNs)
      // shows up in Tempo as a span with no corresponding backend trace to link to.
      propagateTraceHeaderCorsUrls: [/^\/api\//, /^http:\/\/localhost:3000\/api\//],
    }),
  ],
});

export { provider as webTracerProvider };
