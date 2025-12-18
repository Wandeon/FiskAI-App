// src/lib/guidance/preferences.ts
import { drizzleDb } from "@/lib/db/drizzle"
import {
  userGuidancePreferences,
  COMPETENCE_LEVELS,
  GUIDANCE_CATEGORIES,
  type CompetenceLevel,
  type GuidanceCategory,
  type UserGuidancePreferences,
} from "@/lib/db/schema/guidance"
import { eq } from "drizzle-orm"

export { COMPETENCE_LEVELS, GUIDANCE_CATEGORIES }
export type { CompetenceLevel, GuidanceCategory, UserGuidancePreferences }

/**
 * Get user's guidance preferences, creating defaults if not exists
 */
export async function getGuidancePreferences(userId: string): Promise<UserGuidancePreferences> {
  const existing = await drizzleDb
    .select()
    .from(userGuidancePreferences)
    .where(eq(userGuidancePreferences.userId, userId))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  // Create default preferences
  const [created] = await drizzleDb
    .insert(userGuidancePreferences)
    .values({
      userId,
      levelFakturiranje: COMPETENCE_LEVELS.BEGINNER,
      levelFinancije: COMPETENCE_LEVELS.BEGINNER,
      levelEu: COMPETENCE_LEVELS.BEGINNER,
    })
    .returning()

  return created
}

/**
 * Update user's guidance preferences
 */
export async function updateGuidancePreferences(
  userId: string,
  updates: Partial<{
    levelFakturiranje: CompetenceLevel
    levelFinancije: CompetenceLevel
    levelEu: CompetenceLevel
    globalLevel: CompetenceLevel | null
    emailDigest: "daily" | "weekly" | "none"
    pushEnabled: boolean
  }>
): Promise<UserGuidancePreferences> {
  // Ensure record exists
  await getGuidancePreferences(userId)

  const [updated] = await drizzleDb
    .update(userGuidancePreferences)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(userGuidancePreferences.userId, userId))
    .returning()

  return updated
}

/**
 * Set all category levels at once (global quick-set)
 */
export async function setGlobalLevel(
  userId: string,
  level: CompetenceLevel
): Promise<UserGuidancePreferences> {
  return updateGuidancePreferences(userId, {
    globalLevel: level,
    levelFakturiranje: level,
    levelFinancije: level,
    levelEu: level,
  })
}

/**
 * Get the effective level for a specific category
 * (respects global override if set)
 */
export function getEffectiveLevel(
  preferences: UserGuidancePreferences,
  category: GuidanceCategory
): CompetenceLevel {
  // Global level overrides per-category settings
  if (preferences.globalLevel) {
    return preferences.globalLevel as CompetenceLevel
  }

  switch (category) {
    case GUIDANCE_CATEGORIES.FAKTURIRANJE:
      return preferences.levelFakturiranje as CompetenceLevel
    case GUIDANCE_CATEGORIES.FINANCIJE:
      return preferences.levelFinancije as CompetenceLevel
    case GUIDANCE_CATEGORIES.EU:
      return preferences.levelEu as CompetenceLevel
    default:
      return COMPETENCE_LEVELS.BEGINNER
  }
}

/**
 * Check if user should see guidance for a specific feature
 */
export function shouldShowGuidance(
  preferences: UserGuidancePreferences,
  category: GuidanceCategory,
  guidanceType: "tooltip" | "wizard" | "notification" | "detailed_help"
): boolean {
  const level = getEffectiveLevel(preferences, category)

  switch (level) {
    case COMPETENCE_LEVELS.BEGINNER:
      // Beginners see everything
      return true

    case COMPETENCE_LEVELS.AVERAGE:
      // Average users see most things except constant tooltips
      return guidanceType !== "tooltip"

    case COMPETENCE_LEVELS.PRO:
      // Pros only see critical notifications
      return guidanceType === "notification"

    default:
      return true
  }
}

/**
 * Get notification frequency based on level
 */
export function getNotificationDays(level: CompetenceLevel): number[] {
  switch (level) {
    case COMPETENCE_LEVELS.BEGINNER:
      return [7, 3, 1, 0] // 7 days, 3 days, 1 day, same day
    case COMPETENCE_LEVELS.AVERAGE:
      return [3, 1, 0] // 3 days, 1 day, same day
    case COMPETENCE_LEVELS.PRO:
      return [1, 0] // 1 day, same day only
    default:
      return [7, 3, 1, 0]
  }
}

/**
 * Label helpers for UI
 */
export const LEVEL_LABELS: Record<CompetenceLevel, string> = {
  [COMPETENCE_LEVELS.BEGINNER]: "Početnik",
  [COMPETENCE_LEVELS.AVERAGE]: "Srednji",
  [COMPETENCE_LEVELS.PRO]: "Profesionalac",
}

export const CATEGORY_LABELS: Record<GuidanceCategory, string> = {
  [GUIDANCE_CATEGORIES.FAKTURIRANJE]: "Fakturiranje",
  [GUIDANCE_CATEGORIES.FINANCIJE]: "Financije",
  [GUIDANCE_CATEGORIES.EU]: "EU poslovanje",
}

export const LEVEL_DESCRIPTIONS: Record<CompetenceLevel, string> = {
  [COMPETENCE_LEVELS.BEGINNER]: "Puna pomoć: korak-po-korak vodiči, tooltipovi, česti podsjetnici",
  [COMPETENCE_LEVELS.AVERAGE]: "Uravnoteženo: pomoć samo kod rizičnih akcija i novih značajki",
  [COMPETENCE_LEVELS.PRO]:
    "Minimalno: samo kritične obavijesti, brzo sučelje, prečaci na tipkovnici",
}
