// src/lib/regulatory-truth/utils/pipeline-invariants.ts
//
// Pipeline invariants and contract validation for RTL.
// These functions enforce contracts between pipeline stages.

import type { AgentRunOutcome } from "@prisma/client"

/**
 * Invariant violation error.
 * Thrown when a pipeline contract is violated.
 */
export class InvariantViolationError extends Error {
  constructor(
    public invariant: string,
    public details: Record<string, unknown>
  ) {
    super(`Invariant violated: ${invariant}`)
    this.name = "InvariantViolationError"
  }
}

/**
 * Validate that SUCCESS_APPLIED outcome has itemsProduced > 0.
 *
 * This is a critical invariant. SUCCESS_APPLIED means "LLM ran and
 * produced valid output that was applied to the database."
 * If no items were produced, the correct outcome is SUCCESS_NO_CHANGE.
 *
 * @throws InvariantViolationError if itemsProduced = 0 with SUCCESS_APPLIED
 */
export function assertAppliedImpliesItems(
  outcome: AgentRunOutcome | null | undefined,
  itemsProduced: number,
  context: { runId?: string; agentType?: string } = {}
): void {
  if (outcome === "SUCCESS_APPLIED" && itemsProduced === 0) {
    throw new InvariantViolationError("SUCCESS_APPLIED must have itemsProduced > 0", {
      outcome,
      itemsProduced,
      ...context,
    })
  }
}

/**
 * Log an invariant warning without throwing.
 * Use this for soft enforcement during migration.
 */
export function warnInvariantViolation(invariant: string, details: Record<string, unknown>): void {
  console.warn(`[INVARIANT WARNING] ${invariant}:`, JSON.stringify(details))
}

/**
 * Validate that an agent run has valid outcome based on its result.
 * Returns the correct outcome to use.
 *
 * @param hasOutput Whether the agent produced output
 * @param itemsProduced Number of items created in DB
 * @param currentOutcome The outcome set by the agent runner
 */
export function validateOutcome(
  hasOutput: boolean,
  itemsProduced: number,
  currentOutcome: AgentRunOutcome | null
): AgentRunOutcome {
  // If no output, cannot be SUCCESS_APPLIED
  if (!hasOutput) {
    if (currentOutcome === "SUCCESS_APPLIED") {
      warnInvariantViolation("SUCCESS_APPLIED with no output", {
        hasOutput,
        itemsProduced,
        currentOutcome,
      })
      return "EMPTY_OUTPUT"
    }
    return currentOutcome || "EMPTY_OUTPUT"
  }

  // If output but no items, it's SUCCESS_NO_CHANGE
  if (hasOutput && itemsProduced === 0) {
    if (currentOutcome === "SUCCESS_APPLIED") {
      warnInvariantViolation("SUCCESS_APPLIED with itemsProduced=0", {
        hasOutput,
        itemsProduced,
        currentOutcome,
      })
      return "SUCCESS_NO_CHANGE"
    }
    return currentOutcome || "SUCCESS_NO_CHANGE"
  }

  // Output + items = SUCCESS_APPLIED
  if (hasOutput && itemsProduced > 0) {
    return "SUCCESS_APPLIED"
  }

  return currentOutcome || "EMPTY_OUTPUT"
}

/**
 * Contract: Extractor must return either sourcePointerIds OR candidateFactIds.
 * In PHASE-D, only candidateFactIds is populated.
 */
export function assertExtractorOutputValid(
  sourcePointerIds: string[],
  candidateFactIds: string[],
  context: { evidenceId?: string } = {}
): void {
  // In PHASE-D, sourcePointerIds is always empty
  // This is expected behavior, not a violation
  if (sourcePointerIds.length === 0 && candidateFactIds.length === 0) {
    // This is valid - extraction found nothing
    return
  }

  // Log for observability
  if (candidateFactIds.length > 0) {
    console.log(
      `[extractor] Created ${candidateFactIds.length} CandidateFacts for evidence ${context.evidenceId}`
    )
  }
}

/**
 * Contract: Composer requires valid SourcePointers.
 * DEPRECATED in PHASE-D - use CandidateFacts instead.
 */
export function assertComposerInputValid(pointerIds: string[]): void {
  if (pointerIds.length === 0) {
    throw new InvariantViolationError("Composer requires at least one SourcePointer", {
      pointerIds,
    })
  }
}

/**
 * Contract: Rules must have source pointers before approval.
 */
export function assertRuleHasEvidence(ruleId: string, pointerCount: number): void {
  if (pointerCount === 0) {
    throw new InvariantViolationError("Rule must have at least one SourcePointer", {
      ruleId,
      pointerCount,
    })
  }
}

/**
 * Contract: T0/T1 rules require human approval for release.
 */
export function assertCriticalRuleApproved(
  ruleId: string,
  riskTier: string,
  approvedBy: string | null
): void {
  if ((riskTier === "T0" || riskTier === "T1") && !approvedBy) {
    throw new InvariantViolationError("T0/T1 rules require human approval", {
      ruleId,
      riskTier,
      approvedBy,
    })
  }
}
