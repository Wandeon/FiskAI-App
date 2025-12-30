-- Add soft delete fields to news_posts table
ALTER TABLE "news_posts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "deleted_by" varchar(100);--> statement-breakpoint
CREATE INDEX "idx_news_posts_deleted" ON "news_posts" USING btree ("deleted_at");
