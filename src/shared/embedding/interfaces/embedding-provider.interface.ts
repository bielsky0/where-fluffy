// Kontrakt closure-DI, ta sama forma co PasswordHasher/TokenService/GeocodingService — kod
// biznesowy (search.service.ts, ai-worker/embed-pet-data.processor.ts) nie wie, z jakiego modelu
// korzysta ani gdzie jest hostowany.
//
// Pipeline jest vision-only: Pet.embedding to wektor zdjęć (generateImageEmbedding), a tekstowe
// zapytania z modułu search (generateEmbedding) dopasowują się do nich cross-modalnie, bo wieże
// nomic-embed-text-v1.5 i nomic-embed-vision-v1.5 dzielą tę samą przestrzeń 768 dim.
// generateImageEmbedding zwraca JEDEN gotowy wektor za cały zestaw zdjęć — mean-pooling i
// normalizacja L2 żyją wyłącznie w sidecarze (infra/ai-model/vector_math.py, jedyne źródło
// prawdy dla tej matematyki); Node nigdy nie wykonuje arytmetyki na wektorach.
export type EmbeddingProvider = {
  generateEmbedding: (text: string) => Promise<number[]>;
  generateImageEmbedding: (imageUrls: string[]) => Promise<number[]>;
};
