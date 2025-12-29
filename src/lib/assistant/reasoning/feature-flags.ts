// src/lib/assistant/reasoning/feature-flags.ts
//
// Re-exports from unified feature configuration for backward compatibility.
// @see /src/lib/config/features.ts for the single source of truth.

import { getReasoningConfig } from "@/lib/config/features"

export type ReasoningMode = "off" | "shadow" | "live"

/**
 * Check if the Visible Reasoning UX is enabled.
 */
export function isReasoningEnabled(): boolean {
  return getReasoningConfig().enabled
}

/**
 * Get the current reasoning mode.
 * - off: Use legacy pipeline only
 * - shadow: Run both pipelines, legacy serves response, new logs trace
 * - live: Use new reasoning pipeline
 */
export function getReasoningMode(): ReasoningMode {
  return getReasoningConfig().mode
}

/**
 * Check if user is in the reasoning beta cohort.
 * Users can opt-in explicitly OR be selected via percentage-based rollout.
 * @param userId - The user's ID
 * @param userBetaOptIn - Whether the user has explicitly opted into beta (from User.betaOptIn)
 */
export function isInReasoningBeta(userId: string, userBetaOptIn?: boolean): boolean {
  // Explicit opt-in always grants beta access
  if (userBetaOptIn === true) {
    return true
  }

  const percentage = getReasoningConfig().betaPercentage
  if (percentage <= 0) return false
  if (percentage >= 100) return true

  // Simple hash-based rollout for users who haven't explicitly opted in
  const hash = hashString(userId)
  return hash % 100 < percentage
}

/**
 * Get reasoning mode for a specific user.
 * Combines feature flags with per-user beta status and explicit opt-in.
 * @param userId - The user's ID
 * @param userBetaOptIn - Whether the user has explicitly opted into beta
 */
export function getReasoningModeForUser(userId?: string, userBetaOptIn?: boolean): ReasoningMode {
  const globalMode = getReasoningMode()

  // Shadow mode always applies globally
  if (globalMode === "shadow") {
    return "shadow"
  }

  // Live mode respects beta cohort or explicit opt-in
  if (globalMode === "live") {
    if (!userId) return "off"
    return isInReasoningBeta(userId, userBetaOptIn) ? "live" : "off"
  }

  return "off"
}

/**
 * Simple string hash for consistent user bucketing.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}
