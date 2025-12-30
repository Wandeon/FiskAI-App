-- Add rule version tracking to JOPPD submission lines
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'joppd_submission_line'
    ) THEN
        ALTER TABLE "joppd_submission_line"
        ADD COLUMN IF NOT EXISTS "rule_version_id" TEXT;
    END IF;
END $$;

-- Create JOPPD submission lifecycle events table
CREATE TABLE IF NOT EXISTS "joppd_submission_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "status" "JoppdSubmissionStatus" NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "joppd_submission_event_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "joppd_submission_line_rule_version_idx"
ON "joppd_submission_line"("rule_version_id");

CREATE INDEX IF NOT EXISTS "joppd_submission_event_submission_idx"
ON "joppd_submission_event"("submission_id");

CREATE INDEX IF NOT EXISTS "joppd_submission_event_status_idx"
ON "joppd_submission_event"("status");

-- Add foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'joppd_submission_line_rule_version_id_fkey'
    ) THEN
        ALTER TABLE "joppd_submission_line"
        ADD CONSTRAINT "joppd_submission_line_rule_version_id_fkey"
        FOREIGN KEY ("rule_version_id") REFERENCES "RuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'joppd_submission_event_submission_id_fkey'
    ) THEN
        ALTER TABLE "joppd_submission_event"
        ADD CONSTRAINT "joppd_submission_event_submission_id_fkey"
        FOREIGN KEY ("submission_id") REFERENCES "joppd_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
