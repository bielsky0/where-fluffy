// Kontrakt closure-DI, ta sama forma co PasswordHasher/TokenService/GeocodingService — kod
// biznesowy (search.service.ts, ai-worker/embed-pet-data.processor.ts) nie wie, z jakiego modelu
// korzysta ani gdzie jest hostowany.
export type EmbeddingProvider = {
  generateEmbedding: (text: string) => Promise<number[]>;
};
