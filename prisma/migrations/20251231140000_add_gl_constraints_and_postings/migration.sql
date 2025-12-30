-- Extend operational event enums for payroll, assets, and inventory
ALTER TYPE "OperationalSourceType" ADD VALUE IF NOT EXISTS 'PAYROLL';
ALTER TYPE "OperationalSourceType" ADD VALUE IF NOT EXISTS 'ASSET';
ALTER TYPE "OperationalSourceType" ADD VALUE IF NOT EXISTS 'INVENTORY';

ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'PAYROLL_POSTED';
ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'ASSET_ACQUIRED';
ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'ASSET_DEPRECIATION';
ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'ASSET_DISPOSED';
ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'INVENTORY_RECEIPT';
ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'INVENTORY_ISSUE';
ALTER TYPE "OperationalEventType" ADD VALUE IF NOT EXISTS 'INVENTORY_ADJUSTMENT';

-- Enforce valid journal line amounts (single-sided, non-negative)
ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_debit_credit_check"
  CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));

-- Prevent modifications in locked/closed accounting periods
CREATE OR REPLACE FUNCTION enforce_journal_entry_period_unlocked()
RETURNS trigger AS $$
DECLARE
  period_status TEXT;
  period_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    period_id := NEW."periodId";
  ELSIF TG_OP = 'UPDATE' THEN
    period_id := COALESCE(NEW."periodId", OLD."periodId");
  ELSE
    period_id := OLD."periodId";
  END IF;

  IF period_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT "status" INTO period_status FROM "AccountingPeriod" WHERE "id" = period_id;

  IF period_status IN ('CLOSED', 'LOCKED') THEN
    RAISE EXCEPTION 'Accounting period % is locked and cannot be modified.', period_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_journal_line_period_unlocked()
RETURNS trigger AS $$
DECLARE
  entry_id TEXT;
  period_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    entry_id := NEW."journalEntryId";
  ELSIF TG_OP = 'UPDATE' THEN
    entry_id := COALESCE(NEW."journalEntryId", OLD."journalEntryId");
  ELSE
    entry_id := OLD."journalEntryId";
  END IF;

  IF entry_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT ap."status"
    INTO period_status
    FROM "JournalEntry" je
    JOIN "AccountingPeriod" ap ON ap."id" = je."periodId"
    WHERE je."id" = entry_id;

  IF period_status IN ('CLOSED', 'LOCKED') THEN
    RAISE EXCEPTION 'Accounting period for journal entry % is locked and cannot be modified.', entry_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "JournalEntry_period_lock" ON "JournalEntry";
CREATE TRIGGER "JournalEntry_period_lock"
  BEFORE INSERT OR UPDATE OR DELETE ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_entry_period_unlocked();

DROP TRIGGER IF EXISTS "JournalLine_period_lock" ON "JournalLine";
CREATE TRIGGER "JournalLine_period_lock"
  BEFORE INSERT OR UPDATE OR DELETE ON "JournalLine"
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_line_period_unlocked();

-- Enforce balanced posted journal entries at transaction end
CREATE OR REPLACE FUNCTION enforce_posted_journal_entry_balance()
RETURNS trigger AS $$
DECLARE
  debit_sum numeric;
  credit_sum numeric;
  line_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN NULL;
  END IF;

  IF NEW."status" <> 'POSTED' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(*)
    INTO debit_sum, credit_sum, line_count
    FROM "JournalLine"
    WHERE "journalEntryId" = NEW."id";

  IF line_count = 0 THEN
    RAISE EXCEPTION 'Posted journal entry % must have at least one line.', NEW."id";
  END IF;

  IF debit_sum <> credit_sum THEN
    RAISE EXCEPTION 'Unbalanced journal entry %: debit %, credit %.', NEW."id", debit_sum, credit_sum;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_journal_line_balance()
RETURNS trigger AS $$
DECLARE
  entry_id TEXT;
  entry_status TEXT;
  debit_sum numeric;
  credit_sum numeric;
  line_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    entry_id := NEW."journalEntryId";
  ELSIF TG_OP = 'UPDATE' THEN
    entry_id := COALESCE(NEW."journalEntryId", OLD."journalEntryId");
  ELSE
    entry_id := OLD."journalEntryId";
  END IF;

  IF entry_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT "status" INTO entry_status FROM "JournalEntry" WHERE "id" = entry_id;

  IF entry_status <> 'POSTED' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(*)
    INTO debit_sum, credit_sum, line_count
    FROM "JournalLine"
    WHERE "journalEntryId" = entry_id;

  IF line_count = 0 THEN
    RAISE EXCEPTION 'Posted journal entry % must have at least one line.', entry_id;
  END IF;

  IF debit_sum <> credit_sum THEN
    RAISE EXCEPTION 'Unbalanced journal entry %: debit %, credit %.', entry_id, debit_sum, credit_sum;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "JournalEntry_balance_check" ON "JournalEntry";
CREATE CONSTRAINT TRIGGER "JournalEntry_balance_check"
  AFTER INSERT OR UPDATE ON "JournalEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_posted_journal_entry_balance();

DROP TRIGGER IF EXISTS "JournalLine_balance_check" ON "JournalLine";
CREATE CONSTRAINT TRIGGER "JournalLine_balance_check"
  AFTER INSERT OR UPDATE OR DELETE ON "JournalLine"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_line_balance();
