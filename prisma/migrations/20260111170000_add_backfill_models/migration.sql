-- CreateEnum
CREATE TYPE "DiscoveryMethod" AS ENUM ('SENTINEL', 'BACKFILL');

-- CreateEnum
CREATE TYPE "BackfillRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackfillMode" AS ENUM ('SITEMAP', 'ARCHIVE', 'PAGINATION');

-- CreateTable
CREATE TABLE "BackfillRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "BackfillRunStatus" NOT NULL DEFAULT 'PENDING',
    "sources" JSONB NOT NULL,
    "mode" "BackfillMode" NOT NULL,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "maxUrls" INTEGER NOT NULL DEFAULT 1000,
    "concurrency" INTEGER NOT NULL DEFAULT 2,
    "delayMs" INTEGER NOT NULL DEFAULT 5000,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "runBy" TEXT,
    "notes" TEXT,
    "lastProcessedSource" TEXT,
    "lastProcessedPage" INTEGER,
    "lastProcessedUrl" TEXT,

    CONSTRAINT "BackfillRun_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DiscoveredItem" ADD COLUMN "backfillRunId" TEXT;
ALTER TABLE "DiscoveredItem" ADD COLUMN "discoveryMethod" "DiscoveryMethod" NOT NULL DEFAULT 'SENTINEL';

-- CreateIndex
CREATE INDEX "BackfillRun_status_idx" ON "BackfillRun"("status");

-- CreateIndex
CREATE INDEX "BackfillRun_createdAt_idx" ON "BackfillRun"("createdAt");

-- CreateIndex
CREATE INDEX "DiscoveredItem_backfillRunId_idx" ON "DiscoveredItem"("backfillRunId");

-- CreateIndex
CREATE INDEX "DiscoveredItem_discoveryMethod_idx" ON "DiscoveredItem"("discoveryMethod");

-- AddForeignKey
ALTER TABLE "DiscoveredItem" ADD CONSTRAINT "DiscoveredItem_backfillRunId_fkey" FOREIGN KEY ("backfillRunId") REFERENCES "BackfillRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
