-- News System Schema Migration
-- Task 1: Database Schema from docs/plans/2025-12-16-news-system-design.md

-- Create news_categories table
CREATE TABLE IF NOT EXISTS "news_categories" (
  "id" VARCHAR(50) PRIMARY KEY,
  "slug" VARCHAR(100) NOT NULL UNIQUE,
  "name_hr" VARCHAR(200) NOT NULL,
  "parent_id" VARCHAR(50) REFERENCES "news_categories"("id"),
  "icon" VARCHAR(50),
  "color" VARCHAR(20),
  "sort_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_news_categories_slug" ON "news_categories"("slug");
CREATE INDEX IF NOT EXISTS "idx_news_categories_parent" ON "news_categories"("parent_id");

-- Create news_tags table
CREATE TABLE IF NOT EXISTS "news_tags" (
  "id" VARCHAR(50) PRIMARY KEY,
  "slug" VARCHAR(100) NOT NULL UNIQUE,
  "name_hr" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_news_tags_slug" ON "news_tags"("slug");

-- Create news_posts table
CREATE TABLE IF NOT EXISTS "news_posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" VARCHAR(300) NOT NULL UNIQUE,
  "type" VARCHAR(20) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "content" TEXT NOT NULL,
  "excerpt" VARCHAR(500),
  "featured_image_url" VARCHAR(1000),
  "featured_image_source" VARCHAR(200),
  "featured_image_caption" VARCHAR(500),
  "category_id" VARCHAR(50) REFERENCES "news_categories"("id"),
  "tags" JSONB DEFAULT '[]',
  "impact_level" VARCHAR(20),
  "ai_passes" JSONB DEFAULT '{}',
  "status" VARCHAR(20) DEFAULT 'draft' NOT NULL,
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_news_posts_slug" ON "news_posts"("slug");
CREATE INDEX IF NOT EXISTS "idx_news_posts_status" ON "news_posts"("status");
CREATE INDEX IF NOT EXISTS "idx_news_posts_published" ON "news_posts"("published_at");
CREATE INDEX IF NOT EXISTS "idx_news_posts_category" ON "news_posts"("category_id");
CREATE INDEX IF NOT EXISTS "idx_news_posts_type" ON "news_posts"("type");
CREATE INDEX IF NOT EXISTS "idx_news_posts_impact" ON "news_posts"("impact_level");

-- Create news_post_sources junction table
CREATE TABLE IF NOT EXISTS "news_post_sources" (
  "post_id" UUID NOT NULL REFERENCES "news_posts"("id") ON DELETE CASCADE,
  "news_item_id" UUID NOT NULL REFERENCES "news_items"("id") ON DELETE CASCADE,
  PRIMARY KEY ("post_id", "news_item_id")
);

CREATE INDEX IF NOT EXISTS "idx_news_post_sources_post" ON "news_post_sources"("post_id");
CREATE INDEX IF NOT EXISTS "idx_news_post_sources_item" ON "news_post_sources"("news_item_id");

-- Add new columns to news_items table
ALTER TABLE "news_items" ADD COLUMN IF NOT EXISTS "impact_level" VARCHAR(20);
ALTER TABLE "news_items" ADD COLUMN IF NOT EXISTS "assigned_to_post_id" UUID REFERENCES "news_posts"("id");
ALTER TABLE "news_items" ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(1000);
ALTER TABLE "news_items" ADD COLUMN IF NOT EXISTS "image_source" VARCHAR(200);

CREATE INDEX IF NOT EXISTS "idx_news_items_impact" ON "news_items"("impact_level");
CREATE INDEX IF NOT EXISTS "idx_news_items_assigned" ON "news_items"("assigned_to_post_id");
