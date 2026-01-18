-- CreateEnum
CREATE TYPE "ComplianceState" AS ENUM ('OK', 'ATTENTION', 'RISK');

-- AlterTable
ALTER TABLE "MatchRecord" ADD COLUMN "overrideOf" TEXT;

-- CreateTable
CREATE TABLE "ComplianceEvaluation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "state" "ComplianceState" NOT NULL,
    "reasons" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataProvenance" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sourceRef" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceEvaluation_companyId_idx" ON "ComplianceEvaluation"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceEvaluation_companyId_evaluatedAt_idx" ON "ComplianceEvaluation"("companyId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "ComplianceEvaluation_state_idx" ON "ComplianceEvaluation"("state");

-- CreateIndex
CREATE INDEX "DataProvenance_entityType_entityId_idx" ON "DataProvenance"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataProvenance_entityType_entityId_field_idx" ON "DataProvenance"("entityType", "entityId", "field");

-- CreateIndex
CREATE INDEX "DataProvenance_source_idx" ON "DataProvenance"("source");

-- CreateIndex
CREATE INDEX "DataProvenance_capturedAt_idx" ON "DataProvenance"("capturedAt");

-- CreateIndex
CREATE INDEX "MatchRecord_overrideOf_idx" ON "MatchRecord"("overrideOf");

-- AddForeignKey
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
