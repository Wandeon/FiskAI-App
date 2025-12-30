-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('VAT', 'PDV', 'KPR', 'PROFIT_LOSS', 'BALANCE_SHEET');

-- CreateEnum
CREATE TYPE "ReportingState" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SUBMITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewQueueStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewQueuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ReviewQueueEntityType" AS ENUM ('REPORTING_STATUS', 'ACCOUNTING_PERIOD');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "AccountingPeriod" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedById" TEXT,
ADD COLUMN     "lockReason" TEXT;

-- CreateTable
CREATE TABLE "ReviewQueueItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" "ReviewQueueEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "ReviewQueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReviewQueuePriority" NOT NULL DEFAULT 'NORMAL',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ReviewQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "decision" "ReviewDecisionType" NOT NULL,
    "notes" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingStatus" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "status" "ReportingState" NOT NULL DEFAULT 'DRAFT',
    "reviewQueueItemId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewQueueItem_companyId_status_idx" ON "ReviewQueueItem"("companyId", "status");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_entityType_entityId_idx" ON "ReviewQueueItem"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ReviewQueueItem_assignedToId_idx" ON "ReviewQueueItem"("assignedToId");

-- CreateIndex
CREATE INDEX "ReviewDecision_companyId_idx" ON "ReviewDecision"("companyId");

-- CreateIndex
CREATE INDEX "ReviewDecision_reviewId_idx" ON "ReviewDecision"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewDecision_decidedAt_idx" ON "ReviewDecision"("decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingStatus_reviewQueueItemId_key" ON "ReportingStatus"("reviewQueueItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingStatus_companyId_periodId_reportType_key" ON "ReportingStatus"("companyId", "periodId", "reportType");

-- CreateIndex
CREATE INDEX "ReportingStatus_companyId_status_idx" ON "ReportingStatus"("companyId", "status");

-- CreateIndex
CREATE INDEX "ReportingStatus_periodId_idx" ON "ReportingStatus"("periodId");

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewQueueItem" ADD CONSTRAINT "ReviewQueueItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewQueueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingStatus" ADD CONSTRAINT "ReportingStatus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingStatus" ADD CONSTRAINT "ReportingStatus_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingStatus" ADD CONSTRAINT "ReportingStatus_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingStatus" ADD CONSTRAINT "ReportingStatus_reviewQueueItemId_fkey" FOREIGN KEY ("reviewQueueItemId") REFERENCES "ReviewQueueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
