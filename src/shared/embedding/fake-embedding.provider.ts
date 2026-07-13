import { createHash } from 'node:crypto';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface.js';

// mulberry32 — tiny, fast, deterministic PRNG seeded from a 32-bit int. Not cryptographic (nor
// meant to be); it just needs to spread a hash digest into a stable stream of floats.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const l2Normalize = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
};

// Dev/CI default — zero network calls, zero external deps beyond Node's built-in `crypto`.
// Deterministic (same input text always yields the same vector) so integration tests can assert
// exact `ORDER BY embedding <=> ...` ranking, and so the whole enqueue -> worker -> pgvector
// write -> search pipeline is exercisable end-to-end without the self-hosted sidecar running.
// Lokalny l2Normalize to matematyka czysto testowa — produkcyjna normalizacja/pooling żyją
// wyłącznie w sidecarze (infra/ai-model/vector_math.py), patrz komentarz w interfejsie.
export const createFakeEmbeddingProvider = (dimensions = 768): EmbeddingProvider => {
  const generateEmbedding: EmbeddingProvider['generateEmbedding'] = async (text) => {
    const digest = createHash('sha256').update(text).digest();
    const seed = digest.readUInt32BE(0);
    const next = mulberry32(seed);

    const vector = Array.from({ length: dimensions }, () => next() * 2 - 1);
    return l2Normalize(vector);
  };

  // Ten sam deterministyczny hash co dla tekstu, po sklejonych URL-ach — ten sam zestaw zdjęć
  // zawsze daje ten sam wektor, więc worker-owy pipeline testuje się bez prawdziwego modelu.
  const generateImageEmbedding: EmbeddingProvider['generateImageEmbedding'] = (imageUrls) =>
    generateEmbedding(imageUrls.join('\n'));

  return { generateEmbedding, generateImageEmbedding };
};
