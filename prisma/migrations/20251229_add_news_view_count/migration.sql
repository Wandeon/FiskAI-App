-- Add view_count column to news_posts table for analytics
ALTER TABLE "news_posts" ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;

-- Create index for sorting by view count (performance analytics)
CREATE INDEX IF NOT EXISTS "idx_news_posts_view_count" ON "news_posts" ("view_count" DESC);
