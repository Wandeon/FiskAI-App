/**
 * Segment Evaluation Engine
 *
 * Evaluates segment rules against company attributes to determine membership.
 * Supports complex nested conditions with AND/OR logic.
 */

import type {
  SegmentOperator,
  SegmentCondition,
  SegmentRules,
  CompanyAttributes,
  SegmentEvaluationResult,
} from "./types"
import { SEGMENTABLE_FIELDS } from "./types"

/**
 * Evaluate a single condition against company attributes
 */
function evaluateCondition(condition: SegmentCondition, company: CompanyAttributes): boolean {
  const { field, operator, value } = condition
  const fieldDef = SEGMENTABLE_FIELDS[field]

  if (!fieldDef) {
    console.warn(`[segment-evaluator] Unknown field: ${field}`)
    return false
  }

  // Special handling for module checks
  if (fieldDef.type === "module") {
    const moduleKey = value as string
    const hasModule = company.entitlements?.includes(moduleKey) ?? false

    switch (operator) {
      case "EQUALS":
        return hasModule
      case "NOT_EQUALS":
        return !hasModule
      default:
        return false
    }
  }

  // Get the actual value from company
  const actualValue = getFieldValue(company, field)

  // Apply operator
  return applyOperator(actualValue, operator, value, fieldDef.type)
}

/**
 * Get field value from company attributes
 */
function getFieldValue(
  company: CompanyAttributes,
  field: keyof typeof SEGMENTABLE_FIELDS
): unknown {
  switch (field) {
    case "legalForm":
      return company.legalForm
    case "isVatPayer":
      return company.isVatPayer
    case "country":
      return company.country
    case "subscriptionStatus":
      return company.subscriptionStatus
    case "subscriptionPlan":
      return company.subscriptionPlan
    case "trialEndsAt":
      return company.trialEndsAt
    case "invoiceLimit":
      return company.invoiceLimit
    case "userLimit":
      return company.userLimit
    case "fiscalEnabled":
      return company.fiscalEnabled
    case "createdAt":
      return company.createdAt
    case "hasModule":
      return company.entitlements
    default:
      return undefined
  }
}

/**
 * Apply comparison operator
 */
function applyOperator(
  actual: unknown,
  operator: SegmentOperator,
  expected: unknown,
  fieldType: string
): boolean {
  // Handle null checks first
  if (operator === "IS_NULL") {
    return actual === null || actual === undefined
  }
  if (operator === "IS_NOT_NULL") {
    return actual !== null && actual !== undefined
  }

  // For other operators, null actual value means no match
  if (actual === null || actual === undefined) {
    return false
  }

  // Normalize values for comparison
  const normalizedActual = normalizeValue(actual, fieldType)
  const normalizedExpected = normalizeValue(expected, fieldType)

  switch (operator) {
    case "EQUALS":
      return normalizedActual === normalizedExpected

    case "NOT_EQUALS":
      return normalizedActual !== normalizedExpected

    case "IN":
      if (!Array.isArray(normalizedExpected)) return false
      return normalizedExpected.includes(normalizedActual)

    case "NOT_IN":
      if (!Array.isArray(normalizedExpected)) return true
      return !normalizedExpected.includes(normalizedActual)

    case "GREATER_THAN":
      if (fieldType === "date") {
        return new Date(normalizedActual as string) > new Date(normalizedExpected as string)
      }
      return (normalizedActual as number) > (normalizedExpected as number)

    case "LESS_THAN":
      if (fieldType === "date") {
        return new Date(normalizedActual as string) < new Date(normalizedExpected as string)
      }
      return (normalizedActual as number) < (normalizedExpected as number)

    case "GREATER_THAN_OR_EQUAL":
      if (fieldType === "date") {
        return new Date(normalizedActual as string) >= new Date(normalizedExpected as string)
      }
      return (normalizedActual as number) >= (normalizedExpected as number)

    case "LESS_THAN_OR_EQUAL":
      if (fieldType === "date") {
        return new Date(normalizedActual as string) <= new Date(normalizedExpected as string)
      }
      return (normalizedActual as number) <= (normalizedExpected as number)

    case "CONTAINS":
      if (typeof normalizedActual !== "string") return false
      return normalizedActual
        .toLowerCase()
        .includes((normalizedExpected as string).toLowerCase())

    case "NOT_CONTAINS":
      if (typeof normalizedActual !== "string") return true
      return !normalizedActual
        .toLowerCase()
        .includes((normalizedExpected as string).toLowerCase())

    default:
      console.warn(`[segment-evaluator] Unknown operator: ${operator}`)
      return false
  }
}

/**
 * Normalize value for comparison
 */
function normalizeValue(value: unknown, fieldType: string): unknown {
  if (value === null || value === undefined) {
    return null
  }

  switch (fieldType) {
    case "string":
      return String(value)
    case "number":
      return typeof value === "number" ? value : Number(value)
    case "boolean":
      return typeof value === "boolean" ? value : value === "true"
    case "date":
      return value instanceof Date ? value.toISOString() : String(value)
    default:
      return value
  }
}

/**
 * Check if item is a nested rules object
 */
function isNestedRules(item: SegmentCondition | SegmentRules): item is SegmentRules {
  return "operator" in item && "conditions" in item && Array.isArray(item.conditions)
}

/**
 * Evaluate segment rules against company attributes
 */
export function evaluateRules(rules: SegmentRules, company: CompanyAttributes): boolean {
  const { operator, conditions } = rules

  if (conditions.length === 0) {
    return true // Empty conditions match everything
  }

  const results = conditions.map((condition) => {
    if (isNestedRules(condition)) {
      return evaluateRules(condition, company)
    }
    return evaluateCondition(condition, company)
  })

  if (operator === "AND") {
    return results.every(Boolean)
  } else {
    // OR
    return results.some(Boolean)
  }
}

/**
 * Evaluate a segment for a company with detailed results
 */
export function evaluateSegment(
  segmentId: string,
  segmentName: string,
  rules: SegmentRules,
  company: CompanyAttributes
): SegmentEvaluationResult {
  const matches = evaluateRules(rules, company)

  return {
    segmentId,
    segmentName,
    matches,
    evaluatedAt: new Date(),
  }
}

/**
 * Evaluate multiple segments for a company
 */
export function evaluateSegments(
  segments: Array<{ id: string; name: string; rules: SegmentRules }>,
  company: CompanyAttributes
): SegmentEvaluationResult[] {
  return segments.map((segment) =>
    evaluateSegment(segment.id, segment.name, segment.rules, company)
  )
}

/**
 * Find all companies that match a segment (for batch processing)
 */
export function filterCompaniesBySegment(
  rules: SegmentRules,
  companies: CompanyAttributes[]
): CompanyAttributes[] {
  return companies.filter((company) => evaluateRules(rules, company))
}
