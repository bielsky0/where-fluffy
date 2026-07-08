import { z } from 'zod';

// Walidowane raz, przy pierwszym imporcie tego modułu (z instrumentation.ts, zanim padnie
// jakikolwiek inny import) — brakująca/błędna zmienna środowiskowa wysadza proces natychmiast,
// zamiast dać się cicho wyłączonemu tracingowi wykryć dopiero na produkcji.
const otelEnvSchema = z.object({
  OTEL_SERVICE_NAME: z.string().min(1, 'OTEL_SERVICE_NAME is required'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type OtelConfig = z.infer<typeof otelEnvSchema>;

export const otelConfig: OtelConfig = otelEnvSchema.parse(process.env);
