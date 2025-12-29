import { pgTable, uuid, varchar, boolean, timestamp, index, text } from "drizzle-orm/pg-core"

// Note: userId and companyId use text() because Prisma User/Company models use CUIDs, not UUIDs

// Re-export competence levels from single source of truth
export { COMPETENCE_LEVELS, type CompetenceLevel } from "@/lib/types/competence"

// Categories for competence
export const GUIDANCE_CATEGORIES = {
  FAKTURIRANJE: "fakturiranje",
  FINANCIJE: "financije",
  EU: "eu",
} as const

export type GuidanceCategory = (typeof GUIDANCE_CATEGORIES)[keyof typeof GUIDANCE_CATEGORIES]

// Email digest frequency
export const EMAIL_DIGEST_FREQUENCY = {
  DAILY: "daily",
  WEEKLY: "weekly",
  NONE: "none",
} as const

// User guidance preferences - competence levels per category
export const userGuidancePreferences = pgTable(
  "user_guidance_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),

    // Competence levels per category (beginner, average, pro)
    levelFakturiranje: varchar("level_fakturiranje", { length: 20 }).default("beginner").notNull(),
    levelFinancije: varchar("level_financije", { length: 20 }).default("beginner").notNull(),
    levelEu: varchar("level_eu", { length: 20 }).default("beginner").notNull(),

    // Global quick-set (overrides per-category if set)
    globalLevel: varchar("global_level", { length: 20 }),

    // Notification preferences
    emailDigest: varchar("email_digest", { length: 20 }).default("weekly"),
    pushEnabled: boolean("push_enabled").default(true),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_guidance_preferences_user_idx").on(table.userId),
  })
)

// Checklist interaction types
export const CHECKLIST_ACTIONS = {
  COMPLETED: "completed",
  DISMISSED: "dismissed",
  SNOOZED: "snoozed",
} as const

// Checklist item types
export const CHECKLIST_ITEM_TYPES = {
  DEADLINE: "deadline",
  PAYMENT: "payment",
  ACTION: "action",
  ONBOARDING: "onboarding",
  SEASONAL: "seasonal",
  SUGGESTION: "suggestion",
} as const

// Checklist item completions/dismissals
export const checklistInteractions = pgTable(
  "checklist_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: text("company_id").notNull(),

    // Item identification
    itemType: varchar("item_type", { length: 50 }).notNull(),
    itemReference: varchar("item_reference", { length: 100 }).notNull(), // e.g., "deadline:posd:2025-Q4"

    // Action taken
    action: varchar("action", { length: 20 }).notNull(), // completed, dismissed, snoozed
    snoozedUntil: timestamp("snoozed_until"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userCompanyIdx: index("checklist_interactions_user_company_idx").on(
      table.userId,
      table.companyId
    ),
    referenceIdx: index("checklist_interactions_reference_idx").on(table.itemReference),
  })
)

// Type exports for use in application code
export type UserGuidancePreferences = typeof userGuidancePreferences.$inferSelect
export type NewUserGuidancePreferences = typeof userGuidancePreferences.$inferInsert
export type ChecklistInteraction = typeof checklistInteractions.$inferSelect
export type NewChecklistInteraction = typeof checklistInteractions.$inferInsert
