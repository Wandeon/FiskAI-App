// src/lib/guidance/constants.ts
// Client-safe constants (no database imports)

// Competence levels
export const COMPETENCE_LEVELS = {
  BEGINNER: "beginner",
  AVERAGE: "average",
  PRO: "pro",
} as const

export type CompetenceLevel = (typeof COMPETENCE_LEVELS)[keyof typeof COMPETENCE_LEVELS]

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
