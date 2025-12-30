-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('BUILDING', 'EQUIPMENT', 'FURNITURE', 'VEHICLE', 'INTANGIBLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "DepreciationScheduleStatus" AS ENUM ('LOCKED');

-- CreateEnum
CREATE TYPE "AssetCandidateStatus" AS ENUM ('PENDING', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetCandidateSource" AS ENUM ('PROCUREMENT');

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(12,2) NOT NULL,
    "salvageValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationSchedule" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "method" "DepreciationMethod" NOT NULL,
    "periodMonths" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDepreciation" DECIMAL(12,2) NOT NULL,
    "status" "DepreciationScheduleStatus" NOT NULL DEFAULT 'LOCKED',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "accumulatedAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisposalEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "disposalDate" TIMESTAMP(3) NOT NULL,
    "proceeds" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCandidate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" "AssetCandidateSource" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(12,2) NOT NULL,
    "usefulLifeMonths" INTEGER,
    "metadata" JSONB,
    "status" "AssetCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "convertedAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedAsset_companyId_idx" ON "FixedAsset"("companyId");
CREATE INDEX "FixedAsset_status_idx" ON "FixedAsset"("status");
CREATE INDEX "FixedAsset_acquisitionDate_idx" ON "FixedAsset"("acquisitionDate");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationSchedule_assetId_key" ON "DepreciationSchedule"("assetId");
CREATE INDEX "DepreciationSchedule_assetId_idx" ON "DepreciationSchedule"("assetId");
CREATE INDEX "DepreciationSchedule_startDate_idx" ON "DepreciationSchedule"("startDate");
CREATE INDEX "DepreciationSchedule_endDate_idx" ON "DepreciationSchedule"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_scheduleId_sequence_key" ON "DepreciationEntry"("scheduleId", "sequence");
CREATE INDEX "DepreciationEntry_assetId_periodStart_idx" ON "DepreciationEntry"("assetId", "periodStart");
CREATE INDEX "DepreciationEntry_periodEnd_idx" ON "DepreciationEntry"("periodEnd");

-- CreateIndex
CREATE INDEX "DisposalEvent_assetId_idx" ON "DisposalEvent"("assetId");
CREATE INDEX "DisposalEvent_disposalDate_idx" ON "DisposalEvent"("disposalDate");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCandidate_convertedAssetId_key" ON "AssetCandidate"("convertedAssetId");
CREATE UNIQUE INDEX "AssetCandidate_companyId_source_sourceReference_key" ON "AssetCandidate"("companyId", "source", "sourceReference");
CREATE INDEX "AssetCandidate_status_idx" ON "AssetCandidate"("status");
CREATE INDEX "AssetCandidate_companyId_idx" ON "AssetCandidate"("companyId");

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationSchedule" ADD CONSTRAINT "DepreciationSchedule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "DepreciationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisposalEvent" ADD CONSTRAINT "DisposalEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCandidate" ADD CONSTRAINT "AssetCandidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetCandidate" ADD CONSTRAINT "AssetCandidate_convertedAssetId_fkey" FOREIGN KEY ("convertedAssetId") REFERENCES "FixedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
