// src/lib/regulatory-truth/eval/rule-dsl.ts
/**
 * Rule DSL (v1.0)
 *
 * Defines the structure for executable rules compiled from assertions.
 * Minimal operators now, expandable later.
 */

import type { TopicDomain, TopicArea, TopicSubarea, ConfidenceLevel } from "./assertion-schema"

// =============================================================================
// Schema Version
// =============================================================================

export const DSL_VERSION = "1.0"

// =============================================================================
// Operators
// =============================================================================

/** Allowed comparison operators for v1 */
export type ComparisonOp = "gte" | "gt" | "lte" | "lt" | "eq"

/** Future: logical operators */
export type LogicalOp = "and" | "or" | "not" | "in"

// =============================================================================
// Condition
// =============================================================================

export interface Condition {
  op: ComparisonOp
  /** Field path from context-fields registry */
  field: string
  /** Value to compare against */
  value: number | string | boolean
}

// =============================================================================
// Obligation (emitted when rule fires)
// =============================================================================

export interface Obligation {
  type: "OBLIGATION" | "WARNING" | "INFO"
  /** Machine-readable code */
  code: string
  /** Human-readable label in Croatian */
  labelHr: string
  /** Severity level */
  severity: "HIGH" | "MEDIUM" | "LOW"
  /** Explanation template */
  explain: {
    templateHr: string
    data: Record<string, unknown>
  }
}

// =============================================================================
// Rule Source Reference
// =============================================================================

export interface RuleSource {
  assertionId: string
  citations: Array<{
    evidenceId: string
    parseSnapshotId: string
    nodeKey: string
    normSpan: { start: number; end: number }
  }>
}

// =============================================================================
// Rule Structure
// =============================================================================

export interface Rule {
  dslVersion: typeof DSL_VERSION
  ruleId: string
  ruleType: "OBLIGATION" | "CALCULATION" | "CLASSIFICATION"

  topic: {
    domain: TopicDomain
    area: TopicArea
    subarea: TopicSubarea
  }

  /** When this rule applies */
  appliesWhen: Condition

  /** What happens when condition is true */
  then: {
    set: Record<string, unknown>
    emit: Obligation[]
  }

  /** What happens when condition is false */
  else?: {
    set?: Record<string, unknown>
    emit?: Obligation[]
  }

  /** Source assertions that generated this rule */
  sources: RuleSource[]

  /** Confidence metadata */
  confidence: {
    policy: "AUTO_PUBLISH_IF_EXECUTABLE" | "REQUIRES_REVIEW"
    level: ConfidenceLevel
    reasons: string[]
  }

  /** Whether this rule can be evaluated (has all required info) */
  executable: boolean

  /** If not executable, why */
  nonExecutableReason?: string
}

// =============================================================================
// Validation
// =============================================================================

export interface RuleValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a rule object against the DSL schema.
 */
export function validateRule(rule: unknown): RuleValidationResult {
  const errors: string[] = []
  const r = rule as Partial<Rule>

  if (r.dslVersion !== DSL_VERSION) {
    errors.push(`dslVersion must be "${DSL_VERSION}"`)
  }
  if (!r.ruleId) errors.push("ruleId is required")
  if (!r.ruleType) errors.push("ruleType is required")

  // Topic
  if (!r.topic?.domain) errors.push("topic.domain is required")
  if (!r.topic?.area) errors.push("topic.area is required")
  if (!r.topic?.subarea) errors.push("topic.subarea is required")

  // Condition
  if (!r.appliesWhen) {
    errors.push("appliesWhen is required")
  } else {
    const validOps: ComparisonOp[] = ["gte", "gt", "lte", "lt", "eq"]
    if (!validOps.includes(r.appliesWhen.op as ComparisonOp)) {
      errors.push(`appliesWhen.op must be one of: ${validOps.join(", ")}`)
    }
    if (!r.appliesWhen.field) errors.push("appliesWhen.field is required")
    if (r.appliesWhen.value === undefined) errors.push("appliesWhen.value is required")
  }

  // Then
  if (!r.then) {
    errors.push("then is required")
  } else {
    if (!r.then.set) errors.push("then.set is required")
    if (!r.then.emit || !Array.isArray(r.then.emit)) {
      errors.push("then.emit must be an array")
    }
  }

  // Sources
  if (!r.sources || r.sources.length === 0) {
    errors.push("at least 1 source is required")
  }

  return { valid: errors.length === 0, errors }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Generate a unique rule ID.
 */
export function generateRuleId(prefix: string = "rule"): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${timestamp}_${random}`
}

/**
 * Create a threshold obligation rule.
 */
export function createThresholdRule(params: {
  domain: TopicDomain
  area: TopicArea
  subarea: TopicSubarea
  fieldPath: string
  threshold: number
  obligationCode: string
  obligationLabelHr: string
  templateHr: string
  setField: string
  sources: RuleSource[]
}): Rule {
  return {
    dslVersion: DSL_VERSION,
    ruleId: generateRuleId("rule_threshold"),
    ruleType: "OBLIGATION",
    topic: {
      domain: params.domain,
      area: params.area,
      subarea: params.subarea,
    },
    appliesWhen: {
      op: "gte",
      field: params.fieldPath,
      value: params.threshold,
    },
    then: {
      set: { [params.setField]: true },
      emit: [
        {
          type: "OBLIGATION",
          code: params.obligationCode,
          labelHr: params.obligationLabelHr,
          severity: "HIGH",
          explain: {
            templateHr: params.templateHr,
            data: {
              threshold: params.threshold,
              revenueField: params.fieldPath,
            },
          },
        },
      ],
    },
    else: {
      set: { [params.setField]: false },
    },
    sources: params.sources,
    confidence: {
      policy: "AUTO_PUBLISH_IF_EXECUTABLE",
      level: "HIGH",
      reasons: ["single-threshold-single-field"],
    },
    executable: true,
  }
}
