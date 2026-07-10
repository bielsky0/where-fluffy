-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "city" TEXT,
ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
