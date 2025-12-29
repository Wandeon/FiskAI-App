-- Evidence Immutability Trigger
-- Prevents modification of immutable fields at the database level
-- This protects against bypass via $executeRaw, $queryRaw, or direct DB access
--
-- Issue: #898 - RTL Evidence immutability bypass possible via Prisma raw queries
--
-- Protected fields:
--   - rawContent: Source of truth for regulatory chain
--   - contentHash: Integrity hash of rawContent
--   - fetchedAt: Original fetch timestamp

-- Create the trigger function
CREATE OR REPLACE FUNCTION prevent_evidence_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if rawContent is being changed
  IF OLD."rawContent" IS DISTINCT FROM NEW."rawContent" THEN
    RAISE EXCEPTION 'Evidence.rawContent is immutable - cannot be modified after creation';
  END IF;

  -- Check if contentHash is being changed
  IF OLD."contentHash" IS DISTINCT FROM NEW."contentHash" THEN
    RAISE EXCEPTION 'Evidence.contentHash is immutable - cannot be modified after creation';
  END IF;

  -- Check if fetchedAt is being changed
  IF OLD."fetchedAt" IS DISTINCT FROM NEW."fetchedAt" THEN
    RAISE EXCEPTION 'Evidence.fetchedAt is immutable - cannot be modified after creation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS evidence_immutability ON "Evidence";

-- Create the trigger
CREATE TRIGGER evidence_immutability
BEFORE UPDATE ON "Evidence"
FOR EACH ROW EXECUTE FUNCTION prevent_evidence_mutation();

-- Add comment for documentation
COMMENT ON FUNCTION prevent_evidence_mutation() IS
'Enforces immutability of Evidence.rawContent, Evidence.contentHash, and Evidence.fetchedAt at database level.
These fields form the source of truth for the regulatory chain and must never be modified after creation.
See: https://github.com/FiskAI/FiskAI/issues/898';
