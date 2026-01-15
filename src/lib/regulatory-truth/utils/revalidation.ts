// src/lib/regulatory-truth/utils/revalidation.ts
//
// Pure functions for rule revalidation logic.
// Task 4.2: RTL Autonomy - Continuous Re-Validation
//
// This module contains pure, testable functions for:
// - Determining if a rule is due for revalidation
// - Processing validation check results
// - Creating alert data for failed validations
//
// Database operations are in the worker file.

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Revalidation intervals in days based on risk tier.
 *
 * T0: Critical compliance rules - weekly
 * T1: High-risk rules - bi-weekly
 * T2: Medium-risk rules - monthly
 * T3: Low-risk rules - quarterly
 */
export const REVALIDATION_INTERVALS: Record<string, number> = {
  T0: 7, // weekly
  T1: 14, // bi-weekly
  T2: 30, // monthly
  T3: 90, // quarterly
}

/**
 * Minimum confidence threshold. If confidence drops below this,
 * the rule fails revalidation.
 */
export const CONFIDENCE_THRESHOLD = 0.7

// =============================================================================
// TYPES
// =============================================================================

export interface RuleForRevalidation {
  id: string
  riskTier: string
  lastValidatedAt: Date | null
  status: string
}

export interface RevalidationCheck {
  name:
    | "quote-in-evidence"
    | "source-availability"
    | "conflict-detection"
    | "confidence-recalculation"
  passed: boolean
  reason?: string
}

export interface RevalidationFailure {
  check: string
  reason: string
}

export interface RevalidationResult {
  ruleId: string
  passed: boolean
  failures: RevalidationFailure[]
  checks: RevalidationCheck[]
  validatedAt: Date
}

export interface RevalidationAlertData {
  type: "REVALIDATION_FAILED"
  severity: "HIGH"
  affectedRuleIds: string[]
  description: string
  humanActionRequired: boolean
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Check if a rule is due for revalidation based on its risk tier.
 *
 * @param rule - The rule to check
 * @param now - Current date (injectable for testing)
 * @returns true if the rule should be revalidated
 */
export function isRuleDueForRevalidation(
  rule: RuleForRevalidation,
  now: Date = new Date()
): boolean {
  // Only process PUBLISHED rules
  if (rule.status !== "PUBLISHED") {
    return false
  }

  // Get the interval for this risk tier
  const intervalDays = REVALIDATION_INTERVALS[rule.riskTier]
  if (!intervalDays) {
    // Unknown risk tier - default to not due (be safe)
    return false
  }

  // If never validated, it's due
  if (!rule.lastValidatedAt) {
    return true
  }

  // Check if enough time has passed since last validation
  const lastValidated = new Date(rule.lastValidatedAt)
  const daysSinceValidation = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24)

  return daysSinceValidation > intervalDays
}

/**
 * Process revalidation checks and return the result.
 *
 * @param ruleId - The rule being validated
 * @param checks - Array of validation checks performed
 * @param validatedAt - Timestamp of validation (injectable for testing)
 * @returns RevalidationResult with pass/fail status and failures
 */
export function revalidateRule(
  ruleId: string,
  checks: RevalidationCheck[],
  validatedAt: Date = new Date()
): RevalidationResult {
  const failures: RevalidationFailure[] = checks
    .filter((check) => !check.passed)
    .map((check) => ({
      check: check.name,
      reason: check.reason || "Unknown reason",
    }))

  return {
    ruleId,
    passed: failures.length === 0,
    failures,
    checks,
    validatedAt,
  }
}

/**
 * Create alert data for a failed revalidation.
 *
 * @param result - The revalidation result
 * @returns Alert data to be persisted
 */
export function createRevalidationAlert(result: RevalidationResult): RevalidationAlertData {
  const failureDetails = result.failures.map((f) => `${f.check}: ${f.reason}`).join("; ")

  return {
    type: "REVALIDATION_FAILED",
    severity: "HIGH",
    affectedRuleIds: [result.ruleId],
    description:
      `Revalidation failed for rule ${result.ruleId}. ` +
      `Failed checks: ${failureDetails}. ` +
      `Manual review required to verify rule integrity.`,
    humanActionRequired: true,
  }
}

/**
 * Get days until next revalidation for a rule.
 *
 * @param rule - The rule to check
 * @param now - Current date
 * @returns Number of days until next revalidation, or 0 if due now
 */
export function getDaysUntilRevalidation(
  rule: RuleForRevalidation,
  now: Date = new Date()
): number {
  if (rule.status !== "PUBLISHED") {
    return Infinity // Not applicable
  }

  const intervalDays = REVALIDATION_INTERVALS[rule.riskTier]
  if (!intervalDays) {
    return Infinity // Unknown tier
  }

  if (!rule.lastValidatedAt) {
    return 0 // Due now
  }

  const lastValidated = new Date(rule.lastValidatedAt)
  const daysSinceValidation = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24)
  const daysRemaining = intervalDays - daysSinceValidation

  return Math.max(0, Math.ceil(daysRemaining))
}
