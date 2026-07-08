import { Writable } from 'stream';
import { trace, context } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { createLogger } from './logger.js';

// Collects everything written to the logger's destination, one parsed JSON object per line —
// this bypasses pino's `transport` (pino-pretty) entirely, since createLogger() only applies
// it when no explicit destination is given (see logger.ts).
const createCapturingLogger = () => {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, callback) {
      for (const line of chunk.toString('utf8').split('\n')) {
        if (line.trim()) lines.push(JSON.parse(line));
      }
      callback();
    },
  });
  return { logger: createLogger(stream), lines };
};

describe('logger trace/span correlation', () => {
  let provider: BasicTracerProvider;
  let exporter: InMemorySpanExporter;
  let contextManager: AsyncHooksContextManager;

  beforeAll(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);

    // A tracer provider alone doesn't make context.active()/trace.getSpan() see anything —
    // without an installed context manager, the API's default context implementation never
    // tracks "active" spans at all, so startActiveSpan()'s callback would run with no span
    // visible to logger.ts's mixin(). This is exactly what NodeSDK.start() sets up for real in
    // instrumentation.ts; it has to be done by hand here since this test deliberately stays
    // decoupled from that full, self-executing, auto-instrumenting module (see smoke-test.ts
    // for the test that instead verifies the real, fully-wired pipeline end-to-end).
    contextManager = new AsyncHooksContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
  });

  afterAll(async () => {
    contextManager.disable();
    trace.disable();
    context.disable();
    await provider.shutdown();
  });

  afterEach(() => exporter.reset());

  it('stamps trace_id/span_id matching the active span onto every log line', () => {
    const { logger, lines } = createCapturingLogger();
    const tracer = trace.getTracer('logger.spec');

    tracer.startActiveSpan('test-span', (span) => {
      logger.info('inside a span');
      span.end();
    });

    const [finishedSpan] = exporter.getFinishedSpans();
    expect(finishedSpan).toBeDefined();

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      msg: 'inside a span',
      trace_id: finishedSpan.spanContext().traceId,
      span_id: finishedSpan.spanContext().spanId,
    });
  });

  it('two sibling spans produce logs with two different span_ids under the same trace_id', () => {
    const { logger, lines } = createCapturingLogger();
    const tracer = trace.getTracer('logger.spec');

    context.with(trace.setSpan(context.active(), tracer.startSpan('parent')), () => {
      tracer.startActiveSpan('child-a', (span) => {
        logger.info('in child a');
        span.end();
      });
      tracer.startActiveSpan('child-b', (span) => {
        logger.info('in child b');
        span.end();
      });
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].trace_id).toBe(lines[1].trace_id);
    expect(lines[0].span_id).not.toBe(lines[1].span_id);
  });

  it('omits trace_id/span_id entirely when logging outside any active span', () => {
    const { logger, lines } = createCapturingLogger();

    logger.info('no span active here');

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toHaveProperty('trace_id');
    expect(lines[0]).not.toHaveProperty('span_id');
  });
});
