import { createFakeEmbeddingProvider } from './fake-embedding.provider.js';

describe('createFakeEmbeddingProvider', () => {
  it('returns a vector of the configured length', async () => {
    const provider = createFakeEmbeddingProvider(768);

    const vector = await provider.generateEmbedding('friendly dog');

    expect(vector).toHaveLength(768);
    expect(vector.every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
  });

  it('is deterministic — the same input text always yields the same vector', async () => {
    const provider = createFakeEmbeddingProvider(768);

    const first = await provider.generateEmbedding('lost golden retriever near the park');
    const second = await provider.generateEmbedding('lost golden retriever near the park');

    expect(first).toEqual(second);
  });

  it('produces different vectors for different input text', async () => {
    const provider = createFakeEmbeddingProvider(768);

    const dog = await provider.generateEmbedding('friendly dog');
    const cat = await provider.generateEmbedding('shy black cat');

    expect(dog).not.toEqual(cat);
  });

  it('returns an L2-normalized vector', async () => {
    const provider = createFakeEmbeddingProvider(768);

    const vector = await provider.generateEmbedding('friendly dog');
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

    expect(magnitude).toBeCloseTo(1, 5);
  });
});
