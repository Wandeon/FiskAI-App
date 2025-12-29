-- CreateEnum
CREATE TYPE "StaffReviewEntity" AS ENUM ('EINVOICE', 'EXPENSE', 'DOCUMENT');

-- CreateTable
CREATE TABLE "StaffReview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "entityType" "StaffReviewEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "StaffReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffReview_companyId_idx" ON "StaffReview"("companyId");

-- CreateIndex
CREATE INDEX "StaffReview_reviewerId_idx" ON "StaffReview"("reviewerId");

-- CreateIndex
CREATE INDEX "StaffReview_entityType_entityId_idx" ON "StaffReview"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffReview_companyId_entityType_entityId_key" ON "StaffReview"("companyId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new audit actions
-- Note: These are added as part of the AuditAction enum update in schema.prisma
-- The Prisma migration will handle the enum update automatically
