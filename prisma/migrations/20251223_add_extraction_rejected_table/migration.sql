-- CreateTable
CREATE TABLE "ExtractionRejected" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "rejectionType" TEXT NOT NULL,
    "rawOutput" JSONB NOT NULL,
    "errorDetails" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionRejected_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionRejected_evidenceId_idx" ON "ExtractionRejected"("evidenceId");

-- CreateIndex
CREATE INDEX "ExtractionRejected_rejectionType_idx" ON "ExtractionRejected"("rejectionType");

-- CreateIndex
CREATE INDEX "ExtractionRejected_createdAt_idx" ON "ExtractionRejected"("createdAt");

-- AddForeignKey
ALTER TABLE "ExtractionRejected" ADD CONSTRAINT "ExtractionRejected_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
