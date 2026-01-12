-- CreateTable
CREATE TABLE "AgentResultCache" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "inputContentHash" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "tokensUsed" INTEGER,
    "originalRunId" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHitAt" TIMESTAMP(3),

    CONSTRAINT "AgentResultCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentResultCache_agentType_provider_model_promptHash_inputC_key" ON "AgentResultCache"("agentType", "provider", "model", "promptHash", "inputContentHash");

-- CreateIndex
CREATE INDEX "AgentResultCache_agentType_inputContentHash_idx" ON "AgentResultCache"("agentType", "inputContentHash");

-- CreateIndex
CREATE INDEX "AgentResultCache_createdAt_idx" ON "AgentResultCache"("createdAt");
