-- DropIndex
DROP INDEX "OtpCode_identifier_idx";

-- AlterTable: rename instead of drop+add — OtpCode rows are ephemeral (5-minute TTL) so no data
-- is actually at risk, but RENAME COLUMN keeps this migration reversible/inspectable rather than
-- generating a spurious NOT NULL constraint failure on any row present at migration time.
ALTER TABLE "OtpCode" RENAME COLUMN "identifier" TO "email";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerId" TEXT;

-- CreateIndex
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerId_key" ON "User"("provider", "providerId");
