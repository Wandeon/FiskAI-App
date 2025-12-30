-- Add rule version references to payout and JOPPD derived records
ALTER TABLE "payout_line" ADD COLUMN IF NOT EXISTS "rule_version_id" TEXT;
ALTER TABLE "joppd_submission_line" ADD COLUMN IF NOT EXISTS "rule_version_id" TEXT;

CREATE INDEX IF NOT EXISTS "payout_line_rule_version_idx" ON "payout_line"("rule_version_id");
CREATE INDEX IF NOT EXISTS "joppd_submission_line_rule_version_idx" ON "joppd_submission_line"("rule_version_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'payout_line_rule_version_id_fkey'
    ) THEN
        ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_rule_version_id_fkey"
        FOREIGN KEY ("rule_version_id") REFERENCES "RuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'joppd_submission_line_rule_version_id_fkey'
    ) THEN
        ALTER TABLE "joppd_submission_line" ADD CONSTRAINT "joppd_submission_line_rule_version_id_fkey"
        FOREIGN KEY ("rule_version_id") REFERENCES "RuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Repoint travel order rule version references to RuleVersion
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_perDiemRuleVersionId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" DROP CONSTRAINT "TravelOrder_perDiemRuleVersionId_fkey";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_mileageRuleVersionId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" DROP CONSTRAINT "TravelOrder_mileageRuleVersionId_fkey";
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_perDiemRuleVersionId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_perDiemRuleVersionId_fkey"
        FOREIGN KEY ("perDiemRuleVersionId") REFERENCES "RuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'TravelOrder_mileageRuleVersionId_fkey'
    ) THEN
        ALTER TABLE "TravelOrder" ADD CONSTRAINT "TravelOrder_mileageRuleVersionId_fkey"
        FOREIGN KEY ("mileageRuleVersionId") REFERENCES "RuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
