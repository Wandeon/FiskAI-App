"use server"

// src/app/actions/guidance.ts
// Server actions for guidance preferences

import { auth } from "@/lib/auth"
import { setGlobalLevel } from "@/lib/guidance/preferences"
import { COMPETENCE_LEVELS } from "@/lib/db/schema/guidance"
import type { CompetenceLevel } from "@/lib/visibility/rules"

/**
 * Save the user's competence level during onboarding
 */
export async function saveCompetenceLevel(
  competence: CompetenceLevel
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    // Map visibility competence level to guidance competence level
    const guidanceLevel = mapToGuidanceLevel(competence)

    await setGlobalLevel(session.user.id, guidanceLevel)

    return { success: true }
  } catch (error) {
    console.error("Failed to save competence level:", error)
    return { success: false, error: "Failed to save competence level" }
  }
}

/**
 * Map visibility competence levels to guidance competence levels
 */
function mapToGuidanceLevel(
  competence: CompetenceLevel
): (typeof COMPETENCE_LEVELS)[keyof typeof COMPETENCE_LEVELS] {
  switch (competence) {
    case "beginner":
      return COMPETENCE_LEVELS.BEGINNER
    case "average":
      return COMPETENCE_LEVELS.AVERAGE
    case "pro":
      return COMPETENCE_LEVELS.PRO
    default:
      return COMPETENCE_LEVELS.BEGINNER
  }
}
