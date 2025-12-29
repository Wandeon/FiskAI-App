ALTER TABLE "news_items" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "last_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "processing_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "last_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "freshness_status" varchar(20) DEFAULT 'fresh';--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "freshness_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_news_posts_freshness" ON "news_posts" USING btree ("freshness_status");--> statement-breakpoint
CREATE INDEX "idx_news_posts_expires" ON "news_posts" USING btree ("expires_at");