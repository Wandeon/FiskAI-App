import { LIMITS, type AssistantResponse, type RefusalReason } from "./types"

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * FAIL-CLOSED INVARIANT:
 * If topic=REGULATORY and kind=ANSWER, then:
 * - citations.primary MUST exist
 * - citations.primary.url MUST be non-empty
 * - citations.primary.quote MUST be non-empty
 *
 * Violation → validation.valid = false → API must return REFUSAL
 */
export function validateResponse(response: AssistantResponse): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!response.schemaVersion) errors.push("Missing schemaVersion")
  if (!response.requestId) errors.push("Missing requestId")
  if (!response.traceId) errors.push("Missing traceId")
  if (!response.kind) errors.push("Missing kind")
  if (!response.topic) errors.push("Missing topic")
  if (!response.surface) errors.push("Missing surface")

  // Check length limits
  if (response.headline && response.headline.length > LIMITS.headline) {
    errors.push(`Headline exceeds ${LIMITS.headline} chars`)
  }
  if (response.directAnswer && response.directAnswer.length > LIMITS.directAnswer) {
    errors.push(`DirectAnswer exceeds ${LIMITS.directAnswer} chars`)
  }

  // Check for invalid combinations
  if (response.kind === "ANSWER" && response.refusalReason) {
    errors.push("ANSWER cannot have refusalReason (invalid state)")
  }

  // FAIL-CLOSED ENFORCEMENT: REGULATORY + ANSWER requires valid citations
  const matrix = enforceEnforcementMatrix(response)
  if (matrix.citationsRequired) {
    const citationErrors = validateCitationsForRegulatory(response)
    errors.push(...citationErrors)
  }
  if (matrix.citationsForbidden && response.citations) {
    errors.push("Citations not allowed for this response type")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validates that REGULATORY ANSWER has proper citations.
 * Returns array of error messages (empty if valid).
 *
 * FAIL-CLOSED: Primary citation MUST have:
 * - url (non-empty)
 * - quote (non-empty)
 * - evidenceId (non-empty)
 * - fetchedAt (non-empty)
 */
function validateCitationsForRegulatory(response: AssistantResponse): string[] {
  const errors: string[] = []

  if (!response.citations) {
    errors.push("REGULATORY ANSWER requires citations (fail-closed)")
    return errors
  }

  if (!response.citations.primary) {
    errors.push("REGULATORY ANSWER requires citations.primary (fail-closed)")
    return errors
  }

  const primary = response.citations.primary

  if (!primary.url || primary.url.trim() === "") {
    errors.push("REGULATORY ANSWER requires citations.primary.url (fail-closed)")
  }

  if (!primary.quote || primary.quote.trim() === "") {
    errors.push("REGULATORY ANSWER requires citations.primary.quote (fail-closed)")
  }

  if (!primary.evidenceId || primary.evidenceId.trim() === "") {
    errors.push("REGULATORY ANSWER requires citations.primary.evidenceId (fail-closed)")
  }

  if (!primary.fetchedAt || primary.fetchedAt.trim() === "") {
    errors.push("REGULATORY ANSWER requires citations.primary.fetchedAt (fail-closed)")
  }

  return errors
}

export function truncateField(value: string, limit: number): string {
  if (value.length <= limit) return value
  return value.slice(0, limit - 3) + "..."
}

export interface EnforcementResult {
  citationsRequired: boolean
  citationsForbidden: boolean
  computedResultAllowed: boolean
  computedResultForbidden: boolean
}

export function enforceEnforcementMatrix(response: Partial<AssistantResponse>): EnforcementResult {
  const { kind, topic, refusalReason } = response

  // Default: nothing required or forbidden
  const result: EnforcementResult = {
    citationsRequired: false,
    citationsForbidden: false,
    computedResultAllowed: false,
    computedResultForbidden: true,
  }

  if (kind === "ANSWER") {
    if (topic === "REGULATORY") {
      result.citationsRequired = true
      result.computedResultAllowed = true
      result.computedResultForbidden = false
    } else {
      // PRODUCT/SUPPORT/OFFTOPIC
      result.citationsForbidden = true
    }
  } else if (kind === "REFUSAL") {
    if (refusalReason === "UNRESOLVED_CONFLICT") {
      result.citationsRequired = true
    } else if (refusalReason === "MISSING_CLIENT_DATA") {
      // Citations optional
    } else {
      // NO_CITABLE_RULES, OUT_OF_SCOPE
      result.citationsForbidden = true
    }
  }

  return result
}
