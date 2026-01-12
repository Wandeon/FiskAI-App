-- PR-A: AgentRun Outcome Taxonomy + Correlation Fields
-- This migration adds comprehensive LLM waste tracking to the AgentRun table

-- Create new enums
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TYPE "AgentRunOutcome" AS ENUM (
  'SUCCESS_APPLIED',
  'SUCCESS_NO_CHANGE',
  'VALIDATION_REJECTED',
  'LOW_CONFIDENCE',
  'EMPTY_OUTPUT',
  'PARSE_FAILED',
  'CONTENT_LOW_QUALITY',
  'SKIPPED_DETERMINISTIC',
  'CIRCUIT_OPEN',
  'DUPLICATE_CACHED',
  'RETRY_EXHAUSTED',
  'TIMEOUT'
);

CREATE TYPE "NoChangeCode" AS ENUM (
  'ALREADY_EXTRACTED',
  'DUPLICATE_POINTERS',
  'NO_RELEVANT_CHANGES',
  'BELOW_MIN_CONFIDENCE',
  'VALIDATION_BLOCKED'
);

-- Add new columns to AgentRun (before status migration)
ALTER TABLE "AgentRun" ADD COLUMN "inputChars" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN "inputBytes" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN "promptTemplateId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "promptTemplateVersion" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "promptHash" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "outcome" "AgentRunOutcome";
ALTER TABLE "AgentRun" ADD COLUMN "noChangeCode" "NoChangeCode";
ALTER TABLE "AgentRun" ADD COLUMN "noChangeDetail" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "itemsProduced" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgentRun" ADD COLUMN "runId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "jobId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "parentJobId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "sourceSlug" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "queueName" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AgentRun" ADD COLUMN "inputContentHash" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "cacheHit" BOOLEAN NOT NULL DEFAULT false;

-- Migrate status column from String to enum
-- Step 1: Add new temporary column with enum type
ALTER TABLE "AgentRun" ADD COLUMN "status_new" "AgentRunStatus";

-- Step 2: Copy data with mapping (case-insensitive)
UPDATE "AgentRun" SET "status_new" =
  CASE
    WHEN LOWER("status") = 'running' THEN 'RUNNING'::"AgentRunStatus"
    WHEN LOWER("status") = 'completed' THEN 'COMPLETED'::"AgentRunStatus"
    WHEN LOWER("status") = 'failed' THEN 'FAILED'::"AgentRunStatus"
    ELSE 'FAILED'::"AgentRunStatus"  -- Default unknown values to FAILED
  END;

-- Step 3: Drop old column and rename new one
ALTER TABLE "AgentRun" DROP COLUMN "status";
ALTER TABLE "AgentRun" RENAME COLUMN "status_new" TO "status";

-- Step 4: Set default and not null
ALTER TABLE "AgentRun" ALTER COLUMN "status" SET DEFAULT 'RUNNING'::"AgentRunStatus";
ALTER TABLE "AgentRun" ALTER COLUMN "status" SET NOT NULL;

-- Add new indexes for waste analysis queries
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");
CREATE INDEX "AgentRun_outcome_idx" ON "AgentRun"("outcome");
CREATE INDEX "AgentRun_agentType_outcome_startedAt_idx" ON "AgentRun"("agentType", "outcome", "startedAt");
CREATE INDEX "AgentRun_queueName_outcome_startedAt_idx" ON "AgentRun"("queueName", "outcome", "startedAt");
CREATE INDEX "AgentRun_inputContentHash_idx" ON "AgentRun"("inputContentHash");
CREATE INDEX "AgentRun_runId_idx" ON "AgentRun"("runId");
CREATE INDEX "AgentRun_sourceSlug_startedAt_idx" ON "AgentRun"("sourceSlug", "startedAt");
