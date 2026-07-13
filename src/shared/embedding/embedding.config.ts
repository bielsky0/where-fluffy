import { z } from 'zod';

// Mirrors geocoding.config.ts's Zod-validated env pattern — every field has a .default() so this
// never throws at import time, and "fake" is the default provider so nothing regresses if the
// env var is missing in dev/CI (no self-hosted model needed to exercise the pipeline).
const embeddingEnvSchema = z.object({
  EMBEDDING_PROVIDER: z.enum(['fake', 'local']).default('fake'),
  // Sidecar FastAPI (infra/ai-model) — modele są własnością sidecara, nie klienta, stąd brak
  // EMBEDDING_MODEL po stronie Node (dawny wpis ollamowy usunięty razem z samą Ollamą).
  EMBEDDING_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // Osobny, luźniejszy timeout dla /embed/image: sidecar sam pobiera do 5 zdjęć z Cloudinary
  // (po ~5 s twardego limitu każde) i robi inferencję na CPU — 10 s tekstowego limitu
  // gwarantowałoby fałszywe timeouty i wieczne retry BullMQ przy zestawach kilku zdjęć.
  EMBEDDING_IMAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  // Single source of truth for vector length — must match schema.prisma's
  // Pet.embedding Unsupported("vector(768)") column and FakeEmbeddingProvider's output.
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
});

export type EmbeddingConfig = z.infer<typeof embeddingEnvSchema>;

export const embeddingConfig: EmbeddingConfig = embeddingEnvSchema.parse(process.env);
