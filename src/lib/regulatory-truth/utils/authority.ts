// src/lib/regulatory-truth/utils/authority.ts

import { AuthorityLevel } from "@prisma/client"

/**
 * Derive authority level from source slugs
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
