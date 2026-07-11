import { embeddingConfig, EmbeddingConfig } from './embedding.config.js';
import { createFakeEmbeddingProvider } from './fake-embedding.provider.js';
import { createLocalEmbeddingProvider } from './local-embedding.provider.js';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface.js';

// Composed independently in both the api process (src/modules/search/index.ts, query-time
// embedding) and the ai-worker process (src/ai-worker/index.ts, write-time embedding) — same
// factory code, separate instances, each reading its own process's env.
export const createEmbeddingProvider = (config: EmbeddingConfig = embeddingConfig): EmbeddingProvider =>
  config.EMBEDDING_PROVIDER === 'local' ? createLocalEmbeddingProvider(config) : createFakeEmbeddingProvider(config.EMBEDDING_DIMENSIONS);
