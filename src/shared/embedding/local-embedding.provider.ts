import { logger } from '../infrastructure/logger.js';
import { EmbeddingConfig } from './embedding.config.js';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface.js';

type EmbedResponse = { embedding: number[] };

const RETRY_DELAYS_MS = [300, 900];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestEmbedding = async (
  config: EmbeddingConfig,
  path: '/embed/text' | '/embed/image',
  payload: unknown,
  timeoutMs: number,
): Promise<number[]> => {
  const response = await fetch(`${config.EMBEDDING_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`embedding service responded ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as EmbedResponse;
  return body.embedding;
};

// Production provider — calls the self-hosted embedding sidecar (infra/ai-model, FastAPI serving
// the aligned nomic v1.5 text+vision towers; it replaced Ollama, whose embeddings API cannot take
// images) over plain `fetch`, deliberately NOT axios or any third-party AI SDK (this app uses
// zero paid third-party AI APIs). The sidecar owns ALL vector math (per-image embedding,
// mean-pooling, L2 normalization — see infra/ai-model/vector_math.py), so both methods here just
// ship inputs and return the ready-to-store vector.
//
// Unlike geocoding.service.ts's "never throws, swallow-to-null" Silent Fallback contract, this
// provider must NOT silently degrade: an embedding is load-bearing for write/search consistency,
// not an optional enrichment. It retries a couple of times for a transient blip *within this one
// call* (short fixed backoff), then logs a bare `[CRITICAL_AI_ERROR]` (input size only — no
// jobId/petId, since this provider has no BullMQ context) and rethrows. The caller (worker
// processor or search service) is responsible for adding its own jobId-tagged log line and
// deciding what happens next (BullMQ's own coarser job-level retry, or a 503 to a search client).
export const createLocalEmbeddingProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  const withRetries = async (
    run: () => Promise<number[]>,
    logContext: Record<string, number>,
  ): Promise<number[]> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await run();
      } catch (err) {
        lastError = err;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) await sleep(delay);
      }
    }

    logger.error(
      { err: lastError, ...logContext },
      '[CRITICAL_AI_ERROR] embedding generation failed after retries',
    );
    throw lastError;
  };

  const generateEmbedding: EmbeddingProvider['generateEmbedding'] = (text) =>
    withRetries(
      () => requestEmbedding(config, '/embed/text', { text }, config.EMBEDDING_TIMEOUT_MS),
      { textLength: text.length },
    );

  const generateImageEmbedding: EmbeddingProvider['generateImageEmbedding'] = (imageUrls) =>
    withRetries(
      () =>
        requestEmbedding(config, '/embed/image', { urls: imageUrls }, config.EMBEDDING_IMAGE_TIMEOUT_MS),
      { imageCount: imageUrls.length },
    );

  return { generateEmbedding, generateImageEmbedding };
};
