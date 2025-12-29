// src/lib/db/schema/news.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core"

export const newsSources = pgTable(
  "news_sources",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    feedType: varchar("feed_type", { length: 20 }).notNull(), // 'rss', 'scrape'
    feedUrl: varchar("feed_url", { length: 500 }),
    scrapeSelector: text("scrape_selector"),
    isActive: boolean("is_active").default(true).notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    fetchIntervalHours: integer("fetch_interval_hours").default(24).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_news_sources_active").on(table.isActive)]
)

export const newsCategories = pgTable(
  "news_categories",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    nameHr: varchar("name_hr", { length: 200 }).notNull(),
    parentId: varchar("parent_id", { length: 50 }).references((): any => newsCategories.id),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 20 }),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_news_categories_slug").on(table.slug),
    index("idx_news_categories_parent").on(table.parentId),
  ]
)

export const newsTags = pgTable(
  "news_tags",
  {
    id: varchar("id", { length: 50 }).primaryKey(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    nameHr: varchar("name_hr", { length: 200 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_news_tags_slug").on(table.slug)]
)

export const newsPosts = pgTable(
  "news_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 300 }).notNull().unique(),
    type: varchar("type", { length: 20 }).notNull(), // 'individual' | 'digest'
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(), // markdown
    excerpt: varchar("excerpt", { length: 500 }),

    // Images with attribution
    featuredImageUrl: varchar("featured_image_url", { length: 1000 }),
    featuredImageSource: varchar("featured_image_source", { length: 200 }),
    featuredImageCaption: varchar("featured_image_caption", { length: 500 }),

    // Classification
    categoryId: varchar("category_id", { length: 50 }).references(() => newsCategories.id),
    tags: jsonb("tags").default([]), // array of tag slugs
    impactLevel: varchar("impact_level", { length: 20 }), // 'high' | 'medium' | 'low'

    // AI Processing
    aiPasses: jsonb("ai_passes").default({}), // stores all 3 passes
    status: varchar("status", { length: 20 }).default("draft").notNull(), // 'draft' | 'reviewing' | 'published' | 'failed'

    // Error recovery tracking
    processingAttempts: integer("processing_attempts").default(0).notNull(),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

    // Analytics
    viewCount: integer("view_count").default(0).notNull(),

    // Content Freshness
    expiresAt: timestamp("expires_at", { withTimezone: true }), // For time-sensitive content
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }), // Last content accuracy check
    freshnessStatus: varchar("freshness_status", { length: 20 }).default("fresh"), // 'fresh' | 'stale' | 'expired' | 'archived'
    freshnessCheckedAt: timestamp("freshness_checked_at", { withTimezone: true }), // Last staleness check run

    // Timestamps
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_news_posts_slug").on(table.slug),
    index("idx_news_posts_status").on(table.status),
    index("idx_news_posts_published").on(table.publishedAt),
    index("idx_news_posts_category").on(table.categoryId),
    index("idx_news_posts_type").on(table.type),
    index("idx_news_posts_impact").on(table.impactLevel),
    index("idx_news_posts_freshness").on(table.freshnessStatus),
    index("idx_news_posts_expires").on(table.expiresAt),
  ]
)

export const newsPostSources = pgTable(
  "news_post_sources",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => newsPosts.id, { onDelete: "cascade" }),
    newsItemId: uuid("news_item_id")
      .notNull()
      .references(() => newsItems.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.newsItemId] }),
    index("idx_news_post_sources_post").on(table.postId),
    index("idx_news_post_sources_item").on(table.newsItemId),
  ]
)

export const newsItems = pgTable(
  "news_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: varchar("source_id", { length: 100 })
      .notNull()
      .references(() => newsSources.id, { onDelete: "cascade" }),
    sourceUrl: varchar("source_url", { length: 1000 }).notNull(),
    originalTitle: varchar("original_title", { length: 500 }).notNull(),
    originalContent: text("original_content"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),

    // AI-generated fields
    summaryHr: text("summary_hr"), // Croatian summary
    summaryEn: text("summary_en"), // English summary
    categories: jsonb("categories").default([]), // ['tax', 'vat', 'compliance', etc.]
    relevanceScore: varchar("relevance_score", { length: 10 }), // numeric string

    // New fields for news system
    impactLevel: varchar("impact_level", { length: 20 }), // 'high' | 'medium' | 'low'
    assignedToPostId: uuid("assigned_to_post_id").references(() => newsPosts.id),
    imageUrl: varchar("image_url", { length: 1000 }),
    imageSource: varchar("image_source", { length: 200 }),

    // Metadata
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // Error recovery tracking
    processingAttempts: integer("processing_attempts").default(0).notNull(),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_news_items_source").on(table.sourceId),
    index("idx_news_items_published").on(table.publishedAt),
    index("idx_news_items_status").on(table.status),
    index("idx_news_items_url").on(table.sourceUrl),
    index("idx_news_items_impact").on(table.impactLevel),
    index("idx_news_items_assigned").on(table.assignedToPostId),
  ]
)

// Export types
export type NewsSource = typeof newsSources.$inferSelect
export type NewNewsSource = typeof newsSources.$inferInsert

export type NewsCategory = typeof newsCategories.$inferSelect
export type NewNewsCategory = typeof newsCategories.$inferInsert

export type NewsTag = typeof newsTags.$inferSelect
export type NewNewsTag = typeof newsTags.$inferInsert

export type NewsPost = typeof newsPosts.$inferSelect
export type NewNewsPost = typeof newsPosts.$inferInsert

export type NewsPostSource = typeof newsPostSources.$inferSelect
export type NewNewsPostSource = typeof newsPostSources.$inferInsert

export type NewsItem = typeof newsItems.$inferSelect
export type NewNewsItem = typeof newsItems.$inferInsert
