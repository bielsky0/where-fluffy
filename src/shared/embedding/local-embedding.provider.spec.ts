import { createLocalEmbeddingProvider } from './local-embedding.provider.js';
import { EmbeddingConfig } from './embedding.config.js';

jest.mock('../infrastructure/logger.js', () => ({
  logger: { error: jest.fn() },
}));

import { logger } from '../infrastructure/logger.js';

const config: EmbeddingConfig = {
  EMBEDDING_PROVIDER: 'local',
  EMBEDDING_SERVICE_URL: 'http://ai-model:11434',
  EMBEDDING_MODEL: 'nomic-embed-text',
  EMBEDDING_TIMEOUT_MS: 5_000,
  EMBEDDING_DIMENSIONS: 3,
};

describe('createLocalEmbeddingProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('requests the embedding from the configured service and returns it on success', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    } as Response);

    const provider = createLocalEmbeddingProvider(config);
    const vector = await provider.generateEmbedding('lost dog');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ai-model:11434/api/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: 'lost dog' }),
      }),
    );
    expect(vector).toEqual([0.1, 0.2, 0.3]);
  });

  it('retries a transient failure and succeeds on a later attempt', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [1, 1, 1] }) } as Response);

    const provider = createLocalEmbeddingProvider(config);
    const vector = await provider.generateEmbedding('lost cat');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vector).toEqual([1, 1, 1]);
  }, 10_000);

  it('logs [CRITICAL_AI_ERROR] and rethrows once retries are exhausted', async () => {
    const failure = new Error('model unavailable');
    jest.spyOn(global, 'fetch').mockRejectedValue(failure);

    const provider = createLocalEmbeddingProvider(config);

    await expect(provider.generateEmbedding('lost parrot')).rejects.toThrow('model unavailable');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, textLength: 'lost parrot'.length }),
      expect.stringContaining('[CRITICAL_AI_ERROR]'),
    );
  }, 10_000);

  it('throws when the service responds with a non-2xx status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' } as Response);

    const provider = createLocalEmbeddingProvider(config);

    await expect(provider.generateEmbedding('lost hamster')).rejects.toThrow('503');
  }, 10_000);
});
