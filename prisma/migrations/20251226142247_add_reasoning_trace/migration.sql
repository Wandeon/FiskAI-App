-- CreateTable
CREATE TABLE "ReasoningTrace" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "userContextSnapshot" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "domain" TEXT,
    "riskTier" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceCount" INTEGER,
    "eligibleRuleCount" INTEGER,
    "exclusionCount" INTEGER,
    "conflictCount" INTEGER,
    "refusalReason" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasoningTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReasoningTrace_requestId_key" ON "ReasoningTrace"("requestId");

-- CreateIndex
CREATE INDEX "ReasoningTrace_requestId_idx" ON "ReasoningTrace"("requestId");

-- CreateIndex
CREATE INDEX "ReasoningTrace_outcome_idx" ON "ReasoningTrace"("outcome");

-- CreateIndex
CREATE INDEX "ReasoningTrace_riskTier_idx" ON "ReasoningTrace"("riskTier");

-- CreateIndex
CREATE INDEX "ReasoningTrace_createdAt_idx" ON "ReasoningTrace"("createdAt");

-- CreateIndex
CREATE INDEX "ReasoningTrace_confidence_idx" ON "ReasoningTrace"("confidence");
