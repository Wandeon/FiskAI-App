// src/lib/regulatory-truth/utils/authority.ts

import { AuthorityLevel } from "@prisma/client"
import { db, dbReg } from "@/lib/db"

/**
 * Map database hierarchy integer to AuthorityLevel enum
 * Database: 1=Ustav, 2=Zakon, 3=Podzakonski, 4=Pravilnik, 5=Uputa, 6=Mišljenje, 7=Praksa
 */
const HIERARCHY_MAP: Record<number, AuthorityLevel> = {
  1: "LAW", // Ustav (Constitution)
  2: "LAW", // Zakon (Law)
  3: "GUIDANCE", // Podzakonski akt (Bylaw)
  4: "GUIDANCE", // Pravilnik (Regulation)
  5: "PROCEDURE", // Uputa (Instruction)
  6: "PRACTICE", // Mišljenje (Opinion)
  7: "PRACTICE", // Praksa (Practice)
}

/**
 * Derive authority level from source slugs, checking database hierarchy first
 * Async version that queries database for hierarchy field
 * Higher authority wins when multiple sources
 */
export async function deriveAuthorityLevelAsync(
  sources: Array<{ slug: string } | string>
): Promise<AuthorityLevel> {
  const slugs = sources.map((s) => (typeof s === "string" ? s : s.slug))

  // Try to get hierarchy from database first
  if (slugs.length > 0) {
    const dbSources = await dbReg.regulatorySource.findMany({
      where: { slug: { in: slugs } },
      select: { hierarchy: true },
    })

    // Use highest authority from sources (lowest hierarchy number)
    const hierarchies = dbSources.map((s) => s.hierarchy).filter(Boolean)
    if (hierarchies.length > 0) {
      const lowestHierarchy = Math.min(...hierarchies)
      return HIERARCHY_MAP[lowestHierarchy] || "PRACTICE"
    }
  }

  // Fallback to slug-based detection
  return deriveAuthorityLevel(sources)
}

/**
 * Derive authority level from source slugs (synchronous fallback)
 * Higher authority wins when multiple sources
 */
export function deriveAuthorityLevel(sources: Array<{ slug: string } | string>): AuthorityLevel {
  const slugs = sources.map((s) => (typeof s === "string" ? s : s.slug)).map((s) => s.toLowerCase())

  // LAW: Narodne novine (official gazette)
  if (slugs.some((s) => s.includes("narodne-novine") || s.includes("nn"))) {
    return "LAW"
  }

  // GUIDANCE: Tax authority and Ministry of Finance interpretations
  if (
    slugs.some((s) => s.includes("porezna") || s.includes("mfin") || s.includes("ministarstvo"))
  ) {
    return "GUIDANCE"
  }

  // PROCEDURE: Institutional procedures (FINA, HZMO, HZZO)
  if (
    slugs.some(
      (s) =>
        s.includes("fina") || s.includes("hzmo") || s.includes("hzzo") || s.includes("mirovinsko")
    )
  ) {
    return "PROCEDURE"
  }

  // Default to PRACTICE
  return "PRACTICE"
}

/**
 * Get authority level priority (lower = higher authority)
 */
export function getAuthorityPriority(level: AuthorityLevel): number {
  switch (level) {
    case "LAW":
      return 1
    case "GUIDANCE":
      return 2
    case "PROCEDURE":
      return 3
    case "PRACTICE":
      return 4
    default:
      return 99
  }
}
