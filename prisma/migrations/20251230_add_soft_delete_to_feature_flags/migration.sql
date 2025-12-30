-- AlterEnum
ALTER TYPE "FeatureFlagStatus" ADD VALUE 'DELETED';

-- AlterEnum
ALTER TYPE "FeatureFlagAuditAction" ADD VALUE 'DELETED';
ALTER TYPE "FeatureFlagAuditAction" ADD VALUE 'RESTORED';

-- AlterTable
ALTER TABLE "FeatureFlag" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

-- CreateIndex
CREATE INDEX "FeatureFlag_deletedAt_idx" ON "FeatureFlag"("deletedAt");
