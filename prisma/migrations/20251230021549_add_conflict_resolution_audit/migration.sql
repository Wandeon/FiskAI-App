-- CreateTable
CREATE TABLE "ConflictResolutionAudit" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "ruleAId" TEXT,
    "ruleBId" TEXT,
    "resolution" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedBy" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ConflictResolutionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConflictResolutionAudit_conflictId_idx" ON "ConflictResolutionAudit"("conflictId");

-- CreateIndex
CREATE INDEX "ConflictResolutionAudit_ruleAId_idx" ON "ConflictResolutionAudit"("ruleAId");

-- CreateIndex
CREATE INDEX "ConflictResolutionAudit_ruleBId_idx" ON "ConflictResolutionAudit"("ruleBId");

-- CreateIndex
CREATE INDEX "ConflictResolutionAudit_resolvedAt_idx" ON "ConflictResolutionAudit"("resolvedAt");
