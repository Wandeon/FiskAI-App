-- Add embedding status tracking fields to Evidence table for retry mechanism
-- GitHub Issue #828: Evidence embedding generation is fire-and-forget without retry

-- Add new columns for embedding status tracking
ALTER TABLE "Evidence" ADD COLUMN "embeddingStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Evidence" ADD COLUMN "embeddingError" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "embeddingAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

-- Create index for efficient querying of failed/pending embeddings
CREATE INDEX "Evidence_embeddingStatus_idx" ON "Evidence"("embeddingStatus");

-- Backfill existing records: set status based on whether embedding exists
UPDATE "Evidence"
SET "embeddingStatus" = CASE
    WHEN "embedding" IS NOT NULL THEN 'COMPLETED'
    ELSE 'PENDING'
END,
"embeddingUpdatedAt" = NOW()
WHERE "deletedAt" IS NULL;
