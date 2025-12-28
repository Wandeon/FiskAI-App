// src/lib/regulatory-truth/policy/auto-approval-policy.ts
// =============================================================================
// AUTO-APPROVAL POLICY - SINGLE SOURCE OF TRUTH
// =============================================================================
//
// This module defines the ONLY allowlist for auto-approval of regulatory rules.
// All auto-approval decisions MUST go through isAutoApprovalAllowed().
//
// POLICY INVARIANTS:
// 1. T0/T1 rules are NEVER auto-approved (highest risk = always human review)
// 2. Auto-approval requires explicit (source, concept, authority) tuple match
// 3. Confidence must be >= 0.999 (effectively 100%, accounts for float precision)
// 4. Rules must be DRAFT status to enter auto-approval flow
//
// ARCHITECTURE:
// - trusted-source-stage.ts checks eligibility, but the final gate is HERE
// - rule-status-service.ts calls isAutoApprovalAllowed() during approval
// - Prisma extensions enforce status transitions but don't know about allowlist

import { RiskTier, AuthorityLevel } from "@prisma/client"

// =============================================================================
// TYPES
// =============================================================================

/**
 * An entry in the auto-approval allowlist.
 * All fields must match for auto-approval to be allowed.
 */
export interface AutoApprovalEntry {
  /** Source slug (e.g., "hnb") - must match exactly */
  sourceSlug: string
  /** Concept slug prefix (e.g., "exchange-rate-eur-" matches exchange-rate-eur-usd) */
  conceptSlugPrefix: string
  /** Required authority level - uses Prisma enum */
  authorityLevel: AuthorityLevel
  /** Maximum risk tier allowed (T2 or T3 only - T0/T1 are blocked at gate 1) */
  maxRiskTier: "T2" | "T3"
  /** Optional: Reason for this allowlist entry (documentation) */
  justification?: string
}

/**
 * Rule data required for auto-approval check.
 * Uses Prisma enum types for type safety.
 */
export interface RuleForAutoApproval {
  conceptSlug: string
  riskTier: RiskTier
  authorityLevel: AuthorityLevel
  confidence: number
  /** True if evidence is from machine-parseable source (API, structured data) */
  isDeterministic?: boolean
}

export interface AutoApprovalResult {
  allowed: boolean
  reason?: string
  /** Which allowlist entry matched (if allowed) */
  matchedEntry?: AutoApprovalEntry
}

// =============================================================================
// ALLOWLIST
// =============================================================================
// Each entry is a narrow tuple. Add new entries with explicit justification.
// NEVER add entries for T0/T1 rules - they are blocked at gate 1.

const AUTO_APPROVAL_ALLOWLIST: AutoApprovalEntry[] = [
  {
    sourceSlug: "hnb",
    conceptSlugPrefix: "exchange-rate-eur-",
    authorityLevel: "PROCEDURE",
    maxRiskTier: "T3",
    justification:
      "HNB exchange rates are reference data from official API. " +
      "100% deterministic, machine-readable, used for currency conversion only.",
  },
  // Add more entries as needed, with explicit justification
  // Example:
  // {
  //   sourceSlug: "porezna",
  //   conceptSlugPrefix: "interest-rate-statutory-",
  //   authorityLevel: "PROCEDURE",
  //   maxRiskTier: "T2",
  //   justification: "Statutory interest rates from official source...",
  // },
]

// =============================================================================
// TIER ORDERING
// =============================================================================
// T0 = highest risk (critical tax rates, deadlines)
// T3 = lowest risk (reference values)

const RISK_TIER_ORDER: Record<RiskTier, number> = {
  T0: 0, // Highest risk
  T1: 1,
  T2: 2,
  T3: 3, // Lowest risk
}

function isRiskTierAtOrBelowMax(actual: RiskTier, max: "T2" | "T3"): boolean {
  const actualOrder = RISK_TIER_ORDER[actual]
  const maxOrder = RISK_TIER_ORDER[max]
  // Higher number = lower risk, so actual must be >= max
  return actualOrder >= maxOrder
}

// =============================================================================
// CONFIDENCE THRESHOLD
// =============================================================================
// Using >= 0.999 instead of === 1.0 to avoid float precision issues.
// If you truly need "exactly 100%", use isDeterministic boolean instead.

const CONFIDENCE_THRESHOLD = 0.999

// =============================================================================
// MAIN POLICY FUNCTION
// =============================================================================

/**
 * Check if a rule is eligible for auto-approval.
 *
 * This is the SINGLE SOURCE OF TRUTH for auto-approval policy.
 * Called by rule-status-service.ts during approval flow.
 *
 * GATES (in order):
 * 1. T0/T1 rules are NEVER auto-approved
 * 2. Confidence must be >= 0.999 (or isDeterministic = true)
 * 3. Must match an entry in AUTO_APPROVAL_ALLOWLIST
 *
 * @param rule - Rule data to check
 * @param sourceSlug - Source slug for allowlist matching
 * @returns Whether auto-approval is allowed and why
 */
export function isAutoApprovalAllowed(
  rule: RuleForAutoApproval,
  sourceSlug: string
): AutoApprovalResult {
  // ========================================
  // GATE 1: T0/T1 NEVER auto-approved
  // ========================================
  if (rule.riskTier === "T0" || rule.riskTier === "T1") {
    return {
      allowed: false,
      reason: `${rule.riskTier} rules require human review (critical risk tier)`,
    }
  }

  // ========================================
  // GATE 2: Confidence check
  // ========================================
  // Prefer isDeterministic if available, otherwise use threshold
  const hasAdequateConfidence =
    rule.isDeterministic === true || rule.confidence >= CONFIDENCE_THRESHOLD

  if (!hasAdequateConfidence) {
    return {
      allowed: false,
      reason:
        `Confidence ${rule.confidence.toFixed(3)} is below threshold ${CONFIDENCE_THRESHOLD}. ` +
        `Auto-approval requires >= ${CONFIDENCE_THRESHOLD} or isDeterministic=true.`,
    }
  }

  // ========================================
  // GATE 3: Allowlist check
  // ========================================
  const matchedEntry = AUTO_APPROVAL_ALLOWLIST.find(
    (entry) =>
      entry.sourceSlug === sourceSlug &&
      rule.conceptSlug.startsWith(entry.conceptSlugPrefix) &&
      rule.authorityLevel === entry.authorityLevel &&
      isRiskTierAtOrBelowMax(rule.riskTier, entry.maxRiskTier)
  )

  if (!matchedEntry) {
    return {
      allowed: false,
      reason:
        `No allowlist entry for (source=${sourceSlug}, concept=${rule.conceptSlug}, ` +
        `authority=${rule.authorityLevel}, tier=${rule.riskTier})`,
    }
  }

  return {
    allowed: true,
    matchedEntry,
  }
}

/**
 * Get the current allowlist for audit/debugging purposes.
 * Returns a copy to prevent mutation.
 */
export function getAutoApprovalAllowlist(): readonly AutoApprovalEntry[] {
  return [...AUTO_APPROVAL_ALLOWLIST]
}

/**
 * Check if a source is in the allowlist at all (for any concept).
 * Useful for UI hints.
 */
export function isSourceInAllowlist(sourceSlug: string): boolean {
  return AUTO_APPROVAL_ALLOWLIST.some((entry) => entry.sourceSlug === sourceSlug)
}
