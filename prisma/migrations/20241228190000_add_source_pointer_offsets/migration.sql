-- Add SourcePointerMatchType enum
CREATE TYPE "SourcePointerMatchType" AS ENUM ('EXACT', 'NORMALIZED', 'NOT_VERIFIED');

-- Add provenance offset fields to SourcePointer
ALTER TABLE "SourcePointer" ADD COLUMN "startOffset" INTEGER;
ALTER TABLE "SourcePointer" ADD COLUMN "endOffset" INTEGER;
ALTER TABLE "SourcePointer" ADD COLUMN "matchType" "SourcePointerMatchType" DEFAULT 'NOT_VERIFIED';

-- Add index for matchType (for finding unverified pointers)
CREATE INDEX "SourcePointer_matchType_idx" ON "SourcePointer"("matchType");
