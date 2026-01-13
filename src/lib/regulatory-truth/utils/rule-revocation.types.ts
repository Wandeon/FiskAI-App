// src/lib/regulatory-truth/utils/rule-revocation.types.ts
//
// Pure types for rule revocation - no database dependencies

// =============================================================================
// TYPES
// =============================================================================

/**
 * Reasons for revoking a rule.
 */
export enum RevocationReason {
  // Source-related
  SOURCE_RETRACTED = "SOURCE_RETRACTED", // Original source was retracted/corrected
  SOURCE_SUPERSEDED = "SOURCE_SUPERSEDED", // Original source was superseded by newer law
  SOURCE_ERROR = "SOURCE_ERROR", // Error discovered in original source interpretation

  // Extraction-related
  EXTRACTION_ERROR = "EXTRACTION_ERROR", // Error in LLM extraction
  MISINTERPRETATION = "MISINTERPRETATION", // LLM misinterpreted the source

  // Conflict-related
  CONFLICT_RESOLUTION = "CONFLICT_RESOLUTION", // Revoked due to conflict resolution (arbiter decision)
  DUPLICATE = "DUPLICATE", // Rule is a duplicate of another rule

  // External-related
  EXTERNAL_CORRECTION = "EXTERNAL_CORRECTION", // External party (e.g., accountant) identified error
  REGULATORY_CHANGE = "REGULATORY_CHANGE", // Regulation changed, rule no longer valid

  // Administrative
  MANUAL_REVIEW = "MANUAL_REVIEW", // Revoked during manual review process
  QUALITY_ASSURANCE = "QUALITY_ASSURANCE", // Revoked due to QA check failure
}

/**
 * Input for revoking a rule.
 */
export interface RevocationInput {
  ruleId: string
  reason: RevocationReason
  detail: string
  performedBy: string // User ID or system identifier
}

/**
 * Lineage information for a rule.
 */
export interface RuleLineage {
  candidateFactIds: string[]
  agentRunIds: string[]
  sourcePointerIds: string[]
  evidenceIds: string[]
  supersededRuleIds: string[]
}

/**
 * Result of revocation.
 */
export interface RevocationResult {
  success: boolean
  ruleId: string
  previousStatus: string
  lineage: RuleLineage
  error?: string
}
