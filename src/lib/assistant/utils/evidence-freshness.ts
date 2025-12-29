/**
 * Evidence Freshness Validation
 *
 * Validates citation evidence freshness based on authority level and age.
 * Ensures users are aware when evidence may be stale and need verification.
 *
 * Related: GitHub issue #158 - Citation freshness validation
 */

import type { AuthorityLevel } from "@/lib/assistant/types"

// Freshness status for evidence
export type EvidenceFreshnessStatus = "fresh" | "aging" | "stale" | "critical"

// Freshness thresholds in days by authority level
// Higher authority sources (LAW/REGULATION) require more frequent validation
export const FRESHNESS_THRESHOLDS: Record<AuthorityLevel, number> = {
  LAW: 90, // Laws change infrequently but are critical
  REGULATION: 60, // Regulations change more often
  GUIDANCE: 30, // Official guidance may update regularly
  PRACTICE: 14, // Practice guides need frequent updates
}

// Warning threshold (days before becoming stale)
export const WARNING_THRESHOLD_DAYS = 7

export interface FreshnessCheck {
  status: EvidenceFreshnessStatus
  daysSinceFetch: number
  threshold: number
  message: string
  shouldWarn: boolean
  shouldRefetch: boolean
}

/**
 * Get freshness threshold for an authority level
 */
export function getFreshnessThreshold(authority: AuthorityLevel): number {
  return FRESHNESS_THRESHOLDS[authority]
}

/**
 * Calculate days since evidence was fetched
 */
export function calculateDaysSinceFetch(fetchedAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Determine freshness status for evidence
 */
export function checkEvidenceFreshness(
  fetchedAt: Date | null,
  authority: AuthorityLevel,
  hasChanged: boolean = false,
  now: Date = new Date()
): FreshnessCheck {
  // If evidence has changed flag, it's critical regardless of age
  if (hasChanged) {
    return {
      status: "critical",
      daysSinceFetch: fetchedAt ? calculateDaysSinceFetch(fetchedAt, now) : 0,
      threshold: getFreshnessThreshold(authority),
      message: "Source content has changed - evidence needs re-extraction",
      shouldWarn: true,
      shouldRefetch: true,
    }
  }

  // No fetch date means we can't validate freshness
  if (!fetchedAt) {
    return {
      status: "critical",
      daysSinceFetch: 0,
      threshold: getFreshnessThreshold(authority),
      message: "No fetch date available",
      shouldWarn: true,
      shouldRefetch: false,
    }
  }

  const daysSinceFetch = calculateDaysSinceFetch(fetchedAt, now)
  const threshold = getFreshnessThreshold(authority)

  // Critical: evidence is very old (3x threshold)
  if (daysSinceFetch > threshold * 3) {
    return {
      status: "critical",
      daysSinceFetch,
      threshold,
      message: `Evidence is ${daysSinceFetch} days old (critical threshold: ${threshold * 3} days)`,
      shouldWarn: true,
      shouldRefetch: true,
    }
  }

  // Stale: beyond threshold
  if (daysSinceFetch > threshold) {
    return {
      status: "stale",
      daysSinceFetch,
      threshold,
      message: `Evidence is ${daysSinceFetch} days old (threshold: ${threshold} days)`,
      shouldWarn: true,
      shouldRefetch: true,
    }
  }

  // Aging: approaching threshold (within warning period)
  const warningStart = threshold - WARNING_THRESHOLD_DAYS
  if (daysSinceFetch >= warningStart) {
    return {
      status: "aging",
      daysSinceFetch,
      threshold,
      message: `Evidence is ${daysSinceFetch} days old (approaching ${threshold} day threshold)`,
      shouldWarn: true,
      shouldRefetch: false,
    }
  }

  // Fresh: within threshold
  return {
    status: "fresh",
    daysSinceFetch,
    threshold,
    message: `Evidence is ${daysSinceFetch} days old (within ${threshold} day threshold)`,
    shouldWarn: false,
    shouldRefetch: false,
  }
}

/**
 * Format freshness warning for user display
 */
export function formatFreshnessWarning(check: FreshnessCheck): string | null {
  if (!check.shouldWarn) return null

  if (check.status === "critical") {
    if (check.message.includes("changed")) {
      return "Source content has changed - this citation may be outdated"
    }
    return `Last verified ${check.daysSinceFetch} days ago - may be outdated`
  }

  if (check.status === "stale") {
    return `Last verified ${check.daysSinceFetch} days ago`
  }

  if (check.status === "aging") {
    return `Last verified ${check.daysSinceFetch} days ago`
  }

  return null
}

/**
 * Degrade confidence based on evidence age
 * Returns a multiplier (0.0-1.0) to apply to rule confidence
 */
export function calculateFreshnessPenalty(check: FreshnessCheck): number {
  switch (check.status) {
    case "fresh":
      return 1.0 // No penalty
    case "aging":
      return 0.95 // Minor penalty (5%)
    case "stale":
      return 0.85 // Moderate penalty (15%)
    case "critical":
      return 0.7 // Significant penalty (30%)
    default:
      return 1.0
  }
}
