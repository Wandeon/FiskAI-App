ALTER TABLE "content_sync_events" ADD COLUMN "pr_url" text;--> statement-breakpoint
ALTER TABLE "content_sync_events" ADD COLUMN "pr_created_at" timestamp with time zone;