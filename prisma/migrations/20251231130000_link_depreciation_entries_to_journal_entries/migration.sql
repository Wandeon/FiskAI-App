-- Link depreciation entries to journal entries for GL posting traceability
ALTER TABLE "DepreciationEntry" ADD COLUMN "journalEntryId" TEXT;

CREATE INDEX "DepreciationEntry_journalEntryId_idx" ON "DepreciationEntry"("journalEntryId");

ALTER TABLE "DepreciationEntry"
  ADD CONSTRAINT "DepreciationEntry_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
