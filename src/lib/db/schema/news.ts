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
} from "drizzle-orm/pg-core"

export const newsSources = pgTable(
  "news_sources",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    feedType: varchar("feed_type", { length: 20 }).notNull(), // 'rss', 'scrape'
    feedUrl: varchar("feed_url", { length: 500 }),
    scrapeSelector: varchar("scrape_selector", { length: 200 }),
    isActive: boolean("is_active").default(true).notNull(),
    fetchIntervalHours: integer("fetch_interval_hours").default(24).notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_news_sources_active").on(table.isActive)]
)

export const newsItems = pgTable(
  "news_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: varchar("source_id", { length: 100 })
      .notNull()
      .references(() => newsSources.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content"),
    url: varchar("url", { length: 1000 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // AI-generated fields
    summaryHr: text("summary_hr"), // Croatian summary
    categories: jsonb("categories").default([]), // ['tax', 'vat', 'compliance', etc.]
    relevanceScore: integer("relevance_score"), // 0-100

    // Metadata
    processed: boolean("processed").default(false).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_news_items_source").on(table.sourceId),
    index("idx_news_items_published").on(table.publishedAt),
    index("idx_news_items_processed").on(table.processed),
    index("idx_news_items_url").on(table.url),
  ]
)

export type NewsSource = typeof newsSources.$inferSelect
export type NewNewsSource = typeof newsSources.$inferInsert
export type NewsItem = typeof newsItems.$inferSelect
export type NewNewsItem = typeof newsItems.$inferInsert
