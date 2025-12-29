-- Migration 0009: Create content_sync_events table and related enums
-- Reconstructed from drizzle/meta/0009_snapshot.json

DO $$ BEGIN
    CREATE TYPE "public"."content_sync_event_type" AS ENUM('RULE_RELEASED', 'RULE_SUPERSEDED', 'RULE_EFFECTIVE', 'SOURCE_CHANGED', 'POINTERS_CHANGED', 'CONFIDENCE_DROPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."content_sync_status" AS ENUM('PENDING', 'ENQUEUED', 'PROCESSING', 'DONE', 'FAILED', 'DEAD_LETTERED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."dead_letter_reason" AS ENUM('UNMAPPED_CONCEPT', 'INVALID_PAYLOAD', 'MISSING_POINTERS', 'CONTENT_NOT_FOUND', 'FRONTMATTER_PARSE_ERROR', 'PATCH_CONFLICT', 'REPO_WRITE_FAILED', 'DB_WRITE_FAILED', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_sync_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"type" "content_sync_event_type" NOT NULL,
	"status" "content_sync_status" DEFAULT 'PENDING' NOT NULL,
	"rule_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"domain" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"dead_letter_reason" "dead_letter_reason",
	"dead_letter_note" text,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_sync_events_event_id" ON "content_sync_events" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_sync_events_status_created" ON "content_sync_events" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_sync_events_concept_id" ON "content_sync_events" USING btree ("concept_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_sync_events_rule_id" ON "content_sync_events" USING btree ("rule_id");
