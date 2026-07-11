import { logger } from '../infrastructure/logger.js';
import { EmbeddingConfig } from './embedding.config.js';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface.js';

type OllamaEmbeddingsResponse = { embedding: number[] };

const RETRY_DELAYS_MS = [300, 900];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestEmbedding = async (config: EmbeddingConfig, text: string): Promise<number[]> => {
  const response = await fetch(`${config.EMBEDDING_SERVICE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.EMBEDDING_MODEL, prompt: text }),
    signal: AbortSignal.timeout(config.EMBEDDING_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`embedding service responded ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as OllamaEmbeddingsResponse;
  return body.embedding;
};

// Production provider — calls a self-hosted embedding model (Ollama's `/api/embeddings`
// contract: { model, prompt } -> { embedding }) over plain `fetch`, deliberately NOT axios or any
// third-party AI SDK (this app uses zero paid third-party AI APIs).
//
// Unlike geocoding.service.ts's "never throws, swallow-to-null" Silent Fallback contract, this
// provider must NOT silently degrade: an embedding is load-bearing for write/search consistency,
// not an optional enrichment. It retries a couple of times for a transient blip *within this one
// call* (short fixed backoff), then logs a bare `[CRITICAL_AI_ERROR]` (text length only — no
// jobId/petId, since this provider has no BullMQ context) and rethrows. The caller (worker
// processor or search service) is responsible for adding its own jobId-tagged log line and
// deciding what happens next (BullMQ's own coarser job-level retry, or a 503 to a search client).
export const createLocalEmbeddingProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  const generateEmbedding: EmbeddingProvider['generateEmbedding'] = async (text) => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await requestEmbedding(config, text);
      } catch (err) {
        lastError = err;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) await sleep(delay);
      }
    }

    logger.error(
      { err: lastError, textLength: text.length },
      '[CRITICAL_AI_ERROR] embedding generation failed after retries',
    );
    throw lastError;
  };

  return { generateEmbedding };
};
