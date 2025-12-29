-- Migration: Add local image path columns (Issue #299)
-- Fixes hotlinking risk by storing cached local image paths

ALTER TABLE "news_items" ADD COLUMN IF NOT EXISTS "local_image_path" VARCHAR(500);
ALTER TABLE "news_posts" ADD COLUMN IF NOT EXISTS "featured_local_image_path" VARCHAR(500);

-- Add comment for documentation
COMMENT ON COLUMN "news_items"."local_image_path" IS 'Cached local image path (Issue #299 - prevents hotlinking)';
COMMENT ON COLUMN "news_posts"."featured_local_image_path" IS 'Cached local featured image path (Issue #299 - prevents hotlinking)';
