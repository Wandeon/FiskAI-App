CREATE TABLE "news_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" timestamp with time zone NOT NULL,
	"stage" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"summary" jsonb DEFAULT '{}'::jsonb,
	"errors" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "local_image_path" varchar(500);--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "featured_local_image_path" varchar(500);--> statement-breakpoint
CREATE INDEX "idx_news_pipeline_runs_date_stage" ON "news_pipeline_runs" USING btree ("run_date","stage");--> statement-breakpoint
CREATE INDEX "idx_news_pipeline_runs_status" ON "news_pipeline_runs" USING btree ("status");