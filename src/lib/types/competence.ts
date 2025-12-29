// src/lib/types/competence.ts
// Single source of truth for competence levels
// Used by both visibility and guidance systems

export const COMPETENCE_LEVELS = {
  BEGINNER: "beginner",
  AVERAGE: "average",
  PRO: "pro",
} as const

export type CompetenceLevel = (typeof COMPETENCE_LEVELS)[keyof typeof COMPETENCE_LEVELS]
