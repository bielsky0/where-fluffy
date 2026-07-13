import { createEmbeddingProvider } from './embedding-provider.factory.js';
import { EmbeddingConfig } from './embedding.config.js';

const buildConfig = (overrides: Partial<EmbeddingConfig> = {}): EmbeddingConfig => ({
  EMBEDDING_PROVIDER: 'fake',
  EMBEDDING_SERVICE_URL: 'http://localhost:8000',
  EMBEDDING_TIMEOUT_MS: 10_000,
  EMBEDDING_IMAGE_TIMEOUT_MS: 30_000,
  EMBEDDING_DIMENSIONS: 8,
  ...overrides,
});

describe('createEmbeddingProvider', () => {
  it('returns a fake provider when EMBEDDING_PROVIDER is "fake"', async () => {
    const provider = createEmbeddingProvider(buildConfig({ EMBEDDING_PROVIDER: 'fake' }));

    // The fake provider never calls fetch — asserting on vector shape/determinism (already
    // covered by fake-embedding.provider.spec.ts) is enough to prove this branch was selected.
    const vector = await provider.generateEmbedding('test');
    expect(vector).toHaveLength(8);
  });

  it('returns a local provider when EMBEDDING_PROVIDER is "local"', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: [1, 2, 3] }),
    } as Response);

    const provider = createEmbeddingProvider(buildConfig({ EMBEDDING_PROVIDER: 'local' }));
    const vector = await provider.generateEmbedding('test');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/embed/text',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vector).toEqual([1, 2, 3]);

    fetchMock.mockRestore();
  });
});
