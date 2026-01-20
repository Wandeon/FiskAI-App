-- Publish Attempt Telemetry (RTL2)
-- Adds determinism hashes to RegulatoryRule and RulePublishAttempt table
-- for cheap failure diagnosis and idempotent retry detection.

-- Create enums
CREATE TYPE "HashAlgo" AS ENUM ('SHA256');
CREATE TYPE "PublishOutcome" AS ENUM ('SUCCESS', 'BLOCKED', 'FAILED');
CREATE TYPE "RulePublishBlockReason" AS ENUM (
    'MISSING_CANDIDATE_FACT_LINEAGE',
    'MISSING_AGENT_RUN_LINEAGE',
    'PROVENANCE_NOT_FOUND',
    'PROVENANCE_DRIFT',
    'PROVENANCE_MISMATCH',
    'GRAPH_STATUS_NOT_CURRENT',
    'GRAPH_BUILD_FAILED',
    'MISSING_INPUTS_HASH',
    'MISSING_EVIDENCE_HASH',
    'HASH_MISMATCH',
    'PUBLISH_BUDGET_EXCEEDED',
    'TIER_NOT_ELIGIBLE',
    'CONFIDENCE_TOO_LOW',
    'INVALID_STATUS_TRANSITION',
    'ALREADY_PUBLISHED',
    'MANUAL_BLOCK',
    'PENDING_REVIEW'
);

-- Add hash fields to RegulatoryRule
ALTER TABLE "RegulatoryRule" ADD COLUMN "inputsHash" TEXT;
ALTER TABLE "RegulatoryRule" ADD COLUMN "evidenceHash" TEXT;
ALTER TABLE "RegulatoryRule" ADD COLUMN "hashAlgo" "HashAlgo";

-- Create RulePublishAttempt table
CREATE TABLE "RulePublishAttempt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" TEXT NOT NULL,
    "outcome" "PublishOutcome" NOT NULL,
    "blockReasons" "RulePublishBlockReason"[],
    "inputsHashAtAttempt" TEXT,
    "evidenceHashAtAttempt" TEXT,
    "agentRunId" TEXT,
    "jobId" TEXT,
    "errorDetail" TEXT,

    CONSTRAINT "RulePublishAttempt_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "RulePublishAttempt_ruleId_idx" ON "RulePublishAttempt"("ruleId");
CREATE INDEX "RulePublishAttempt_createdAt_idx" ON "RulePublishAttempt"("createdAt");
CREATE INDEX "RulePublishAttempt_outcome_idx" ON "RulePublishAttempt"("outcome");
CREATE INDEX "RulePublishAttempt_agentRunId_idx" ON "RulePublishAttempt"("agentRunId");

-- Add foreign key
ALTER TABLE "RulePublishAttempt" ADD CONSTRAINT "RulePublishAttempt_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "RegulatoryRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
