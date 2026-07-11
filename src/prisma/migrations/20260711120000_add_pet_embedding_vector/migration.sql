-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN "embedding" vector(768);

-- CreateIndex
-- HNSW index for cosine-distance similarity search (pgvector's `<=>` operator). Prisma's
-- postgresqlExtensions preview IndexType enum has no "Hnsw" variant (confirmed against
-- prisma@6.19.3 — `@@index([embedding], type: Hnsw)` fails schema validation with
-- "Unknown index type: Hnsw"), so this index is hand-written here rather than declared in
-- schema.prisma, mirroring how the migration for Pet.location's GIST index was authored.
CREATE INDEX "Pet_embedding_idx" ON "Pet" USING hnsw ("embedding" vector_cosine_ops);
