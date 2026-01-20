// src/lib/regulatory-truth/eval/evaluator.ts
/**
 * Rule Evaluator
 *
 * Evaluates rules against an evaluation context.
 * Returns structured results with citations.
 */

import type { EvaluationContext } from "./context-fields"
import { getContextValue, setContextValue, isValidFieldPath } from "./context-fields"
import type { Rule, Condition, Obligation, ComparisonOp } from "./rule-dsl"

// =============================================================================
// Evaluation Result
// =============================================================================

export interface EvaluationResult {
  /** Whether evaluation succeeded */
  success: boolean
  /** The rule that was evaluated */
  ruleId: string
  /** Whether the condition matched */
  matched: boolean
  /** Obligations emitted (if any) */
  obligations: Obligation[]
  /** Fields that were set */
  setFields: Record<string, unknown>
  /** Evaluation details for explainability */
  evaluation: {
    field: string
    fieldValue: unknown
    operator: ComparisonOp
    threshold: unknown
    result: boolean
  }
  /** Citations from the rule */
  citations: Array<{
    label: string
    nodeKey: string
    evidenceId: string
  }>
  /** Error message if evaluation failed */
  error?: string
}

// =============================================================================
// Comparison Logic
// =============================================================================

function compare(op: ComparisonOp, a: unknown, b: unknown): boolean {
  // Handle number comparisons
  if (typeof a === "number" && typeof b === "number") {
    switch (op) {
      case "gte":
        return a >= b
      case "gt":
        return a > b
      case "lte":
        return a <= b
      case "lt":
        return a < b
      case "eq":
        return a === b
    }
  }

  // Handle string equality
  if (typeof a === "string" && typeof b === "string" && op === "eq") {
    return a === b
  }

  // Handle boolean equality
  if (typeof a === "boolean" && typeof b === "boolean" && op === "eq") {
    return a === b
  }

  // Can't compare
  return false
}

// =============================================================================
// Evaluator
// =============================================================================

/**
 * Evaluate a single rule against a context.
 */
export function evaluateRule(rule: Rule, context: EvaluationContext): EvaluationResult {
  // Check if rule is executable
  if (!rule.executable) {
    return {
      success: false,
      ruleId: rule.ruleId,
      matched: false,
      obligations: [],
      setFields: {},
      evaluation: {
        field: rule.appliesWhen.field,
        fieldValue: undefined,
        operator: rule.appliesWhen.op,
        threshold: rule.appliesWhen.value,
        result: false,
      },
      citations: [],
      error: rule.nonExecutableReason || "Rule is not executable",
    }
  }

  // Validate field path
  if (!isValidFieldPath(rule.appliesWhen.field)) {
    return {
      success: false,
      ruleId: rule.ruleId,
      matched: false,
      obligations: [],
      setFields: {},
      evaluation: {
        field: rule.appliesWhen.field,
        fieldValue: undefined,
        operator: rule.appliesWhen.op,
        threshold: rule.appliesWhen.value,
        result: false,
      },
      citations: [],
      error: `Unknown field: ${rule.appliesWhen.field}`,
    }
  }

  // Get field value from context
  const fieldValue = getContextValue(context, rule.appliesWhen.field)

  // Check if field value is present
  if (fieldValue === undefined || fieldValue === null) {
    return {
      success: false,
      ruleId: rule.ruleId,
      matched: false,
      obligations: [],
      setFields: {},
      evaluation: {
        field: rule.appliesWhen.field,
        fieldValue: undefined,
        operator: rule.appliesWhen.op,
        threshold: rule.appliesWhen.value,
        result: false,
      },
      citations: buildCitations(rule),
      error: `Missing required field: ${rule.appliesWhen.field}`,
    }
  }

  // Evaluate condition
  const conditionResult = compare(rule.appliesWhen.op, fieldValue, rule.appliesWhen.value)

  // Apply then or else branch
  const branch = conditionResult ? rule.then : rule.else
  const setFields: Record<string, unknown> = {}

  if (branch?.set) {
    for (const [path, value] of Object.entries(branch.set)) {
      setFields[path] = value
      setContextValue(context, path, value)
    }
  }

  return {
    success: true,
    ruleId: rule.ruleId,
    matched: conditionResult,
    obligations: conditionResult ? rule.then.emit : (branch?.emit ?? []),
    setFields,
    evaluation: {
      field: rule.appliesWhen.field,
      fieldValue,
      operator: rule.appliesWhen.op,
      threshold: rule.appliesWhen.value,
      result: conditionResult,
    },
    citations: buildCitations(rule),
  }
}

/**
 * Build citation labels from rule sources.
 */
function buildCitations(rule: Rule): Array<{ label: string; nodeKey: string; evidenceId: string }> {
  const citations: Array<{ label: string; nodeKey: string; evidenceId: string }> = []

  for (const source of rule.sources) {
    for (const citation of source.citations) {
      citations.push({
        label: `Assertion ${source.assertionId}`,
        nodeKey: citation.nodeKey,
        evidenceId: citation.evidenceId,
      })
    }
  }

  return citations
}

// =============================================================================
// Answer Generation
// =============================================================================

export interface AnswerResult {
  /** The answer text in Croatian */
  answerHr: string
  /** Whether this is an evaluated (executable) answer or citeable-only */
  evaluated: boolean
  /** Evaluation details (if evaluated) */
  evaluation?: {
    field: string
    value: unknown
    threshold: unknown
    comparison: string
  }
  /** Citations */
  citations: Array<{
    label: string
    nodeKey: string
    evidenceId: string
  }>
  /** Confidence level */
  confidence: "HIGH" | "MEDIUM" | "LOW"
  /** What field is missing (if not evaluated) */
  missingField?: string
}

/**
 * Generate a human-readable answer from an evaluation result.
 */
export function generateAnswer(result: EvaluationResult, rule: Rule): AnswerResult {
  // If evaluation failed due to missing field
  if (!result.success && result.error?.includes("Missing required field")) {
    const threshold = rule.appliesWhen.value
    return {
      answerHr:
        `Prag za obvezni ulazak u sustav PDV-a je ${threshold} EUR. ` +
        `Ako mi kažeš prihod u zadnjih 12 mjeseci, mogu izračunati.`,
      evaluated: false,
      citations: result.citations,
      confidence: "MEDIUM",
      missingField: rule.appliesWhen.field,
    }
  }

  // If evaluation failed for other reasons
  if (!result.success) {
    return {
      answerHr: `Nisam uspio evaluirati pravilo: ${result.error}`,
      evaluated: false,
      citations: result.citations,
      confidence: "LOW",
    }
  }

  // Successful evaluation
  const threshold = rule.appliesWhen.value as number
  const revenue = result.evaluation.fieldValue as number

  if (result.matched) {
    // Must register
    return {
      answerHr:
        `Da, moraš ući u sustav PDV-a jer si prešao prag od ${threshold.toLocaleString("hr-HR")} EUR ` +
        `(tvoj prihod: ${revenue.toLocaleString("hr-HR")} EUR).`,
      evaluated: true,
      evaluation: {
        field: result.evaluation.field,
        value: revenue,
        threshold,
        comparison: ">=",
      },
      citations: result.citations,
      confidence: "HIGH",
    }
  } else {
    // Exempt
    return {
      answerHr:
        `Ne, trenutno ne moraš u sustav PDV-a jer nisi prešao prag od ${threshold.toLocaleString("hr-HR")} EUR ` +
        `(tvoj prihod: ${revenue.toLocaleString("hr-HR")} EUR). Možeš se dobrovoljno upisati ako želiš.`,
      evaluated: true,
      evaluation: {
        field: result.evaluation.field,
        value: revenue,
        threshold,
        comparison: "<",
      },
      citations: result.citations,
      confidence: "HIGH",
    }
  }
}
