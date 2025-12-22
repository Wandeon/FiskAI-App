-- AlterTable
ALTER TABLE "SourcePointer" ADD COLUMN     "articleNumber" TEXT,
ADD COLUMN     "lawReference" TEXT,
ADD COLUMN     "paragraphNumber" TEXT;

-- CreateIndex
CREATE INDEX "SourcePointer_articleNumber_idx" ON "SourcePointer"("articleNumber");
