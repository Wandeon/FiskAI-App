-- Add meaningSignature field to RegulatoryRule
ALTER TABLE "RegulatoryRule" ADD COLUMN "meaningSignature" TEXT;

-- Create index on meaningSignature for fast lookups
CREATE INDEX "RegulatoryRule_meaningSignature_idx" ON "RegulatoryRule"("meaningSignature");

-- Create partial unique index: only one active truth per meaning
-- This allows multiple DRAFT/PENDING_REVIEW candidates but enforces uniqueness for APPROVED/PUBLISHED
CREATE UNIQUE INDEX "RegulatoryRule_meaningSignature_active_unique"
ON "RegulatoryRule"("meaningSignature")
WHERE "status" IN ('APPROVED', 'PUBLISHED') AND "meaningSignature" IS NOT NULL;

-- Create TruthHealthSnapshot table for monitoring
CREATE TABLE "TruthHealthSnapshot" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Rule counts by status
    "totalRules" INTEGER NOT NULL,
    "publishedRules" INTEGER NOT NULL,
    "approvedRules" INTEGER NOT NULL,
    "pendingReviewRules" INTEGER NOT NULL,
    "draftRules" INTEGER NOT NULL,
    "rejectedRules" INTEGER NOT NULL,

    -- Pointer coverage metrics
    "totalPointers" INTEGER NOT NULL,
    "unlinkedPointers" INTEGER NOT NULL,
    "unlinkedPointersRate" DOUBLE PRECISION NOT NULL,

    -- Evidence quality
    "rulesWithMultiplePointers" INTEGER NOT NULL,
    "multiplePointerRate" DOUBLE PRECISION NOT NULL,
    "publishedWithTwoPlus" INTEGER NOT NULL,
    "publishedPointerCoverage" DOUBLE PRECISION NOT NULL,

    -- Consolidation health
    "duplicateGroupsDetected" INTEGER NOT NULL,
    "testDataLeakage" INTEGER NOT NULL,
    "aliasResolutionsToday" INTEGER NOT NULL,

    -- Concept health
    "totalConcepts" INTEGER NOT NULL,
    "conceptsWithRules" INTEGER NOT NULL,
    "orphanedConcepts" INTEGER NOT NULL,

    -- Alerts triggered
    "alertsTriggered" TEXT[],

    CONSTRAINT "TruthHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- Index for querying by timestamp
CREATE INDEX "TruthHealthSnapshot_timestamp_idx" ON "TruthHealthSnapshot"("timestamp");

-- Backfill meaningSignature for existing rules
-- Using MD5 as a simpler hash function available in PostgreSQL
UPDATE "RegulatoryRule"
SET "meaningSignature" = MD5(
    COALESCE("conceptSlug", '') || '|' ||
    COALESCE("value", '') || '|' ||
    COALESCE("valueType", '') || '|' ||
    TO_CHAR("effectiveFrom", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
    COALESCE(TO_CHAR("effectiveUntil", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '')
)
WHERE "meaningSignature" IS NULL;
