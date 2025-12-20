// src/lib/db/schema/tutorials.ts

import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core"
import { createId } from "@paralleldrive/cuid2"

export const tutorialProgress = pgTable(
  "tutorial_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id").notNull(),
    companyId: text("company_id").notNull(),
    trackId: text("track_id").notNull(),
    completedTasks: jsonb("completed_tasks").$type<string[]>().default([]),
    currentDay: text("current_day").default("1"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userCompanyIdx: index("tutorial_user_company_idx").on(table.userId, table.companyId),
    trackIdx: index("tutorial_track_idx").on(table.trackId),
  })
)

// Type exports for use in application code
export type TutorialProgress = typeof tutorialProgress.$inferSelect
export type NewTutorialProgress = typeof tutorialProgress.$inferInsert
