-- Fix schema drift for columns referenced by Prisma schema/tests but missing from DB.
-- This repo historically used db push in places; migrations must be the source of truth.

-- Artifact.generatorVersion (default 'unknown')
ALTER TABLE "Artifact"
  ADD COLUMN IF NOT EXISTS "generatorVersion" TEXT NOT NULL DEFAULT 'unknown';

-- payout_line.applied_rule_snapshot_id (soft ref to AppliedRuleSnapshot)
ALTER TABLE "payout_line"
  ADD COLUMN IF NOT EXISTS "applied_rule_snapshot_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payout_line_applied_rule_snapshot_id_fkey'
  ) THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT payout_line_applied_rule_snapshot_id_fkey
      FOREIGN KEY ("applied_rule_snapshot_id")
      REFERENCES "AppliedRuleSnapshot"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

