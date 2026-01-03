-- PR#9: Remove RuleVersion relations from PayoutLine and JoppdSubmissionLine
-- This migration drops FK constraints to unblock RuleVersion migration to regulatory schema

-- Drop FK constraints using name-proof discovery
-- This approach finds constraints by their definition, not by assumed names
DO $$
DECLARE
  r record;
BEGIN
  -- Drop all FKs from payout_line that reference rule_version
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'payout_line'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%rule_version%'
  LOOP
    RAISE NOTICE 'Dropping FK constraint % from payout_line', r.conname;
    EXECUTE format('ALTER TABLE payout_line DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;

  -- Drop all FKs from joppd_submission_line that reference rule_version
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = 'joppd_submission_line'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%rule_version%'
  LOOP
    RAISE NOTICE 'Dropping FK constraint % from joppd_submission_line', r.conname;
    EXECUTE format('ALTER TABLE joppd_submission_line DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

-- Verification: This query should return zero rows after migration
-- Run manually to confirm FK removal:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE contype = 'f'
--   AND conrelid IN ('payout_line'::regclass, 'joppd_submission_line'::regclass)
--   AND pg_get_constraintdef(oid) ILIKE '%rule_version%';

-- Note: The ruleVersionId columns and their indexes are intentionally kept
-- They serve as soft references for audit/debugging purposes
-- All rule data access should go through AppliedRuleSnapshot
