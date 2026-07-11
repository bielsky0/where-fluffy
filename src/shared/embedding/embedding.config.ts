import { z } from 'zod';

// Mirrors geocoding.config.ts's Zod-validated env pattern — every field has a .default() so this
// never throws at import time, and "fake" is the default provider so nothing regresses if the
// env var is missing in dev/CI (no self-hosted model needed to exercise the pipeline).
const embeddingEnvSchema = z.object({
  EMBEDDING_PROVIDER: z.enum(['fake', 'local']).default('fake'),
  EMBEDDING_SERVICE_URL: z.string().url().default('http://localhost:11434'),
  EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // Single source of truth for vector length — must match schema.prisma's
  // Pet.embedding Unsupported("vector(768)") column and FakeEmbeddingProvider's output.
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
});

export type EmbeddingConfig = z.infer<typeof embeddingEnvSchema>;

export const embeddingConfig: EmbeddingConfig = embeddingEnvSchema.parse(process.env);
