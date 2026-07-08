import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

const isProduction = process.env.NODE_ENV === 'production';

// Factory instead of a bare `pino({...})` singleton so tests can inject a plain writable
// stream and read back raw JSON synchronously (see logger.spec.ts) — pino's `transport` option
// (used below for dev pretty-printing) spins up a worker thread that writes straight to stdout,
// which can't be intercepted from inside the same process. Passing an explicit `destination`
// bypasses transport entirely, which is exactly what the test wants and what a future non-dev
// destination (e.g. shipping straight to Loki) would also want.
export const createLogger = (destination?: pino.DestinationStream): pino.Logger => {
  const options: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    // `mixin()` runs on every single log call (not just once at logger creation), so it always
    // reads whichever span is active *at that call site* — this is what makes trace/span
    // correlation automatic: callers never have to thread a trace id through manually (see
    // chat.service.ts's sendMessage for a real usage example). Field names (`trace_id`/
    // `span_id`) match OTel's own semantic conventions for logs and the regex Loki's derived
    // field config expects (infra/grafana/provisioning/datasources/datasources.yml) — renaming
    // either side without the other breaks Trace-to-Logs correlation in Grafana.
    mixin() {
      const span = trace.getSpan(context.active());
      if (!span) return {};

      const { traceId, spanId } = span.spanContext();
      return { trace_id: traceId, span_id: spanId };
    },
  };

  if (!destination && !isProduction) {
    options.transport = { target: 'pino-pretty' };
  }

  return destination ? pino(options, destination) : pino(options);
};

export const logger = createLogger();
