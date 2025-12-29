-- AlterTable: Add staleness tracking fields to Evidence
-- GitHub issue #893: RTL Stale data handling - no expiration for regulatory evidence

ALTER TABLE "Evidence" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Evidence" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Evidence" ADD COLUMN "sourceEtag" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "sourceLastMod" TIMESTAMP(3);
ALTER TABLE "Evidence" ADD COLUMN "verifyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN "stalenessStatus" TEXT NOT NULL DEFAULT 'FRESH';

-- CreateIndex
CREATE INDEX "Evidence_stalenessStatus_idx" ON "Evidence"("stalenessStatus");
CREATE INDEX "Evidence_expiresAt_idx" ON "Evidence"("expiresAt");
CREATE INDEX "Evidence_lastVerifiedAt_idx" ON "Evidence"("lastVerifiedAt");
