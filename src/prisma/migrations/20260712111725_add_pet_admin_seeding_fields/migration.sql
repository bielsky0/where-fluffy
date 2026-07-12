-- DropIndex
-- Prisma's schema-diff engine flags this hand-written HNSW index (added in
-- 20260711120000_add_pet_embedding_vector's migration.sql, not representable in schema.prisma —
-- see that migration's own comment) as drift on every `prisma migrate dev` run and drops it,
-- since schema.prisma never declares it. Immediately recreated below — do not remove the
-- CreateIndex block, or vector similarity search (findSimilar/search module) loses its index.
DROP INDEX "Pet_embedding_idx";

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "isAdminAdded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalContact" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateIndex
CREATE INDEX "Pet_embedding_idx" ON "Pet" USING hnsw ("embedding" vector_cosine_ops);
