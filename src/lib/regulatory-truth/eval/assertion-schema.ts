// src/lib/regulatory-truth/eval/assertion-schema.ts
/**
 * Assertion Schema (v1.0)
 *
 * Defines the structure for extracted legal assertions.
 * Designed to work for any numeric threshold, anchored to evidence.
 */

// =============================================================================
// Schema Version
// =============================================================================

export const ASSERTION_SCHEMA_VERSION = "1.0"

// =============================================================================
// Core Types
// =============================================================================

export type AssertionType = "THRESHOLD" | "RATE" | "DEADLINE" | "DEFINITION" | "CONDITION"

export type TopicDomain = "TAX" | "LABOR" | "CORPORATE" | "SOCIAL"
export type TopicArea = "VAT" | "INCOME_TAX" | "CORPORATE_TAX" | "CONTRIBUTIONS" | "GENERAL"
export type TopicSubarea = "REGISTRATION" | "RATES" | "EXEMPTIONS" | "DEADLINES" | "GENERAL"

export type MeasurementBasis = "TRAILING_12_MONTHS" | "CALENDAR_YEAR" | "TAX_PERIOD" | "UNKNOWN"

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"

export type ValueKind = "MONEY" | "PERCENTAGE" | "COUNT" | "DAYS"

// =============================================================================
// Citation
// =============================================================================

export interface Citation {
  /** Source system identifier */
  sourceSystem: "NN" | "POREZNA" | "FINA" | "OTHER"
  /** Human-readable instrument name */
  instrumentHintHr: string
  /** NN coordinates if applicable */
  nn?: {
    year: number
    issue: number
    item: number
  }
  /** ELI URI if available */
  eliUri?: string | null
  /** Reference to Evidence record */
  evidenceId: string
  /** Reference to ParseSnapshot record */
  parseSnapshotId: string
  /** Node key in the parse tree */
  nodeKey: string
  /** Human-readable node label */
  nodeLabel?: string
  /** Span in normalized text */
  normSpan: {
    start: number
    end: number
  }
  /** The quoted text (Croatian) */
  quoteHr: string
}

// =============================================================================
// Assertion Structure
// =============================================================================

export interface Assertion {
  schemaVersion: typeof ASSERTION_SCHEMA_VERSION
  assertionId: string
  assertionType: AssertionType

  topic: {
    domain: TopicDomain
    area: TopicArea
    subarea: TopicSubarea
  }

  subject: {
    /** Machine-readable code for the subject */
    code: string
    /** Human-readable label in Croatian */
    labelHr: string
  }

  jurisdiction: {
    country: string // ISO code
    authority: string // "NN", "POREZNA", etc.
  }

  value: {
    kind: ValueKind
    amount: number
    currency?: string // For MONEY
    scale?: number // e.g., 1 for units, 100 for percentages stored as decimals
  }

  measurementWindow: {
    basis: MeasurementBasis
    notesHr?: string
  }

  appliesTo?: {
    taxpayerScope?: string[] // ["OBRT", "DOO", "JDOO", "OTHER"]
    registrationType?: "MANDATORY" | "VOLUNTARY" | "BOTH"
    voluntaryAllowed?: boolean
  }

  ruleIntent?: {
    effect: string // "TRIGGERS_REGISTRATION", "SETS_RATE", etc.
    conditionSummaryHr: string
  }

  confidence: {
    score: number // 0.0 - 1.0
    level: ConfidenceLevel
    reasons: string[]
  }

  citations: Citation[]

  temporal?: {
    effectiveFrom?: string | null // ISO date
    effectiveUntil?: string | null // ISO date
  }

  crossReferences?: Array<{
    rawText?: string | null
    resolved: boolean
    targetNodeKey?: string | null
  }>

  raw?: {
    extractedFromTextHr?: string | null
  }
}

// =============================================================================
// Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate an assertion object against the schema.
 */
export function validateAssertion(assertion: unknown): ValidationResult {
  const errors: string[] = []
  const a = assertion as Partial<Assertion>

  // Required fields
  if (a.schemaVersion !== ASSERTION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${ASSERTION_SCHEMA_VERSION}"`)
  }
  if (!a.assertionId) errors.push("assertionId is required")
  if (!a.assertionType) errors.push("assertionType is required")

  // Topic
  if (!a.topic?.domain) errors.push("topic.domain is required")
  if (!a.topic?.area) errors.push("topic.area is required")
  if (!a.topic?.subarea) errors.push("topic.subarea is required")

  // Subject
  if (!a.subject?.code) errors.push("subject.code is required")

  // Jurisdiction
  if (!a.jurisdiction?.country) errors.push("jurisdiction.country is required")

  // Value
  if (!a.value?.kind) errors.push("value.kind is required")
  if (typeof a.value?.amount !== "number") errors.push("value.amount must be a number")
  if (a.value?.kind === "MONEY" && !a.value?.currency) {
    errors.push("value.currency is required for MONEY kind")
  }

  // Citations
  if (!a.citations || a.citations.length === 0) {
    errors.push("at least 1 citation is required")
  } else {
    for (let i = 0; i < a.citations.length; i++) {
      const c = a.citations[i]
      if (!c.evidenceId) errors.push(`citations[${i}].evidenceId is required`)
      if (!c.parseSnapshotId) errors.push(`citations[${i}].parseSnapshotId is required`)
      if (!c.nodeKey) errors.push(`citations[${i}].nodeKey is required`)
      if (typeof c.normSpan?.start !== "number") {
        errors.push(`citations[${i}].normSpan.start is required`)
      }
      if (typeof c.normSpan?.end !== "number") {
        errors.push(`citations[${i}].normSpan.end is required`)
      }
      if (c.normSpan && c.normSpan.start >= c.normSpan.end) {
        errors.push(`citations[${i}].normSpan.start must be < end`)
      }
      if (!c.quoteHr) errors.push(`citations[${i}].quoteHr is required`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Generate a unique assertion ID.
 */
export function generateAssertionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `ast_${timestamp}${random}`
}

/**
 * Create a threshold assertion with required fields.
 */
export function createThresholdAssertion(params: {
  subjectCode: string
  subjectLabelHr: string
  domain: TopicDomain
  area: TopicArea
  subarea: TopicSubarea
  amount: number
  currency: string
  measurementBasis: MeasurementBasis
  citation: Citation
  effectiveFrom?: string | null
}): Assertion {
  return {
    schemaVersion: ASSERTION_SCHEMA_VERSION,
    assertionId: generateAssertionId(),
    assertionType: "THRESHOLD",
    topic: {
      domain: params.domain,
      area: params.area,
      subarea: params.subarea,
    },
    subject: {
      code: params.subjectCode,
      labelHr: params.subjectLabelHr,
    },
    jurisdiction: {
      country: "HR",
      authority: "NN",
    },
    value: {
      kind: "MONEY",
      amount: params.amount,
      currency: params.currency,
      scale: 1,
    },
    measurementWindow: {
      basis: params.measurementBasis,
    },
    confidence: {
      score: 0,
      level: "UNKNOWN",
      reasons: [],
    },
    citations: [params.citation],
    temporal: {
      effectiveFrom: params.effectiveFrom ?? null,
      effectiveUntil: null,
    },
  }
}
