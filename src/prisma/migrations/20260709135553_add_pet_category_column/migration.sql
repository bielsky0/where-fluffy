-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'other';

-- CreateIndex
CREATE INDEX "Pet_category_idx" ON "Pet"("category");

-- DataMigration: backfill category on pre-existing rows from the free-text species column,
-- using the same keyword heuristic as web/src/modules/pets/lib/petType.ts's petEmoji()/
-- matchesPetType() (CAT_KEYWORDS = ['kot','cat'], DOG_KEYWORDS = ['pies','dog']) and this
-- backend's ported version in src/modules/pets/pets.category.ts. That frontend function checks
-- cat keywords before dog, so a species matching both ("kot i pies") resolves to 'cat' — run
-- the dog UPDATE first and the cat UPDATE second so the same double-match rows end up 'cat'
-- here too (the later UPDATE wins).
UPDATE "Pet" SET category = 'dog' WHERE species ILIKE '%pies%' OR species ILIKE '%dog%';
UPDATE "Pet" SET category = 'cat' WHERE species ILIKE '%kot%' OR species ILIKE '%cat%';
