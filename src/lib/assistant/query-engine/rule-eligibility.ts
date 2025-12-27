// src/lib/assistant/query-engine/rule-eligibility.ts

import {
  evaluateAppliesWhen,
  parseAppliesWhen,
  type EvaluationContext,
} from "@/lib/regulatory-truth/dsl/applies-when"

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: "EXPIRED" | "FUTURE" | "CONDITION_FALSE" | "MISSING_CONTEXT" }

export interface RuleWithAppliesWhen {
  id: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  appliesWhen: string | null
}

/**
 * Check if a rule's temporal bounds are valid for the given date.
 *
 * Boundary semantics:
 * - effectiveFrom is INCLUSIVE: rule is effective ON the effectiveFrom date
 * - effectiveUntil is EXCLUSIVE: rule is NOT effective ON the effectiveUntil date
 *
 * Formula: effectiveFrom <= asOfDate AND (effectiveUntil IS NULL OR effectiveUntil > asOfDate)
 */
export function checkTemporalEligibility(
  rule: Pick<RuleWithAppliesWhen, "effectiveFrom" | "effectiveUntil">,
  asOfDate: Date
): EligibilityResult {
  // Normalize dates to start of day for consistent comparison
  const queryDate = normalizeToStartOfDay(asOfDate)
  const fromDate = normalizeToStartOfDay(rule.effectiveFrom)
  const untilDate = rule.effectiveUntil ? normalizeToStartOfDay(rule.effectiveUntil) : null

  // Rule must have started (effectiveFrom <= asOfDate, i.e., fromDate is inclusive)
  if (fromDate > queryDate) {
    return { eligible: false, reason: "FUTURE" }
  }

  // Rule must not have expired (effectiveUntil > asOfDate, i.e., untilDate is exclusive)
  // null effectiveUntil means no expiry
  if (untilDate !== null && untilDate <= queryDate) {
    return { eligible: false, reason: "EXPIRED" }
  }

  return { eligible: true }
}

/**
 * Normalize a date to the start of day (00:00:00.000) in UTC.
 * This ensures consistent date comparisons regardless of time components.
 */
function normalizeToStartOfDay(date: Date): Date {
  const normalized = new Date(date)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

/**
 * Extract required context fields from an appliesWhen predicate.
 * Returns the set of field paths that must exist for evaluation.
 */
export function extractRequiredFields(appliesWhen: string | null): Set<string> {
  const fields = new Set<string>()

  if (!appliesWhen) return fields

  try {
    const predicate = parseAppliesWhen(appliesWhen)
    collectFields(predicate, fields)
  } catch {
    // Invalid predicate - no fields required
  }

  return fields
}

function collectFields(predicate: unknown, fields: Set<string>): void {
  if (!predicate || typeof predicate !== "object") return

  const p = predicate as Record<string, unknown>
  const op = p.op as string

  switch (op) {
    case "and":
    case "or":
      if (Array.isArray(p.args)) {
        for (const arg of p.args) {
          collectFields(arg, fields)
        }
      }
      break

    case "not":
      collectFields(p.arg, fields)
      break

    case "cmp":
    case "in":
    case "exists":
    case "between":
    case "matches":
      if (typeof p.field === "string") {
        fields.add(p.field)
      }
      break

    case "date_in_effect":
      if (typeof p.dateField === "string") {
        fields.add(p.dateField)
      }
      break
  }
}

/**
 * Check if context has all required fields for evaluating appliesWhen.
 */
export function checkContextCompleteness(
  requiredFields: Set<string>,
  context: EvaluationContext
): { complete: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  for (const field of requiredFields) {
    const value = getNestedValue(context, field)
    if (value === undefined || value === null) {
      missingFields.push(field)
    }
  }

  return {
    complete: missingFields.length === 0,
    missingFields,
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Check if a rule's appliesWhen condition is satisfied.
 * Returns MISSING_CONTEXT if required fields are not present.
 */
export function checkConditionalEligibility(
  rule: Pick<RuleWithAppliesWhen, "appliesWhen">,
  context: EvaluationContext
): EligibilityResult {
  // No condition = always applies
  if (!rule.appliesWhen) {
    return { eligible: true }
  }

  try {
    const predicate = parseAppliesWhen(rule.appliesWhen)

    // Check for { op: "true" } - always applicable
    if (
      typeof predicate === "object" &&
      predicate !== null &&
      "op" in predicate &&
      predicate.op === "true"
    ) {
      return { eligible: true }
    }

    // Extract and check required fields
    const requiredFields = extractRequiredFields(rule.appliesWhen)
    const { complete, missingFields } = checkContextCompleteness(requiredFields, context)

    if (!complete) {
      console.log(
        `[eligibility] Missing context fields for rule evaluation: ${missingFields.join(", ")}`
      )
      return { eligible: false, reason: "MISSING_CONTEXT" }
    }

    // Evaluate the predicate
    const applies = evaluateAppliesWhen(predicate, context)

    if (!applies) {
      return { eligible: false, reason: "CONDITION_FALSE" }
    }

    return { eligible: true }
  } catch (error) {
    // Invalid predicate - treat as always applicable (fail-open for parsing errors)
    // This is logged but doesn't block - the rule may still be relevant
    console.warn(`[eligibility] Failed to parse appliesWhen: ${error}`)
    return { eligible: true }
  }
}

/**
 * Full eligibility check combining temporal and conditional logic.
 * This is the HARD GATE - ineligible rules are excluded.
 */
export function checkRuleEligibility(
  rule: RuleWithAppliesWhen,
  context: EvaluationContext
): EligibilityResult {
  const asOfDate = new Date(context.asOf)

  // Check temporal eligibility first
  const temporalResult = checkTemporalEligibility(rule, asOfDate)
  if (!temporalResult.eligible) {
    return temporalResult
  }

  // Check conditional eligibility
  return checkConditionalEligibility(rule, context)
}

/**
 * Build an EvaluationContext from assistant request data.
 */
export function buildEvaluationContext(params: {
  asOfDate?: Date
  companyData?: {
    legalForm?: string
    vatStatus?: string
    activityNkd?: string
    county?: string
    revenueYtd?: number
  }
  transactionData?: {
    kind?: string
    paymentMethod?: string
    amount?: number
    b2b?: boolean
  }
}): EvaluationContext {
  const { asOfDate = new Date(), companyData, transactionData } = params

  // Map legalForm to entity type
  let entityType: EvaluationContext["entity"]["type"] = "OTHER"
  let obrtSubtype: EvaluationContext["entity"]["obrtSubtype"] | undefined

  if (companyData?.legalForm) {
    const form = companyData.legalForm.toUpperCase()
    if (form.includes("DOO") && !form.includes("JDOO")) {
      entityType = "DOO"
    } else if (form.includes("JDOO")) {
      entityType = "JDOO"
    } else if (form.includes("OBRT")) {
      entityType = "OBRT"
      if (form.includes("PAUSAL")) {
        obrtSubtype = "PAUSALNI"
      } else if (form.includes("DOHODAS")) {
        obrtSubtype = "DOHODAS"
      } else if (form.includes("DOBITAS")) {
        obrtSubtype = "DOBITAS"
      }
    } else if (form.includes("UDRUGA")) {
      entityType = "UDRUGA"
    }
  }

  // Map VAT status
  let vatStatus: EvaluationContext["entity"]["vat"]["status"] = "UNKNOWN"
  if (companyData?.vatStatus) {
    const vat = companyData.vatStatus.toUpperCase()
    if (vat.includes("IN") || vat === "PDV") {
      vatStatus = "IN_VAT"
    } else if (vat.includes("OUT") || vat === "NO_PDV") {
      vatStatus = "OUTSIDE_VAT"
    }
  }

  // Build context
  const context: EvaluationContext = {
    asOf: asOfDate.toISOString(),
    entity: {
      type: entityType,
      obrtSubtype,
      vat: { status: vatStatus },
      activityNkd: companyData?.activityNkd,
      location: { country: "HR", county: companyData?.county },
    },
    counters:
      companyData?.revenueYtd !== undefined ? { revenueYtd: companyData.revenueYtd } : undefined,
  }

  // Add transaction context if provided
  if (transactionData) {
    const kindUpper = transactionData.kind?.toUpperCase()
    const validKinds = ["SALE", "PURCHASE", "PAYMENT", "PAYROLL", "OTHER"] as const
    const txnKind = validKinds.includes(kindUpper as (typeof validKinds)[number])
      ? (kindUpper as (typeof validKinds)[number])
      : "OTHER"

    const paymentUpper = transactionData.paymentMethod?.toUpperCase()
    const validPayments = ["CASH", "CARD", "TRANSFER", "OTHER"] as const
    const paymentMethod = validPayments.includes(paymentUpper as (typeof validPayments)[number])
      ? (paymentUpper as (typeof validPayments)[number])
      : undefined

    context.txn = {
      kind: txnKind,
      paymentMethod,
      amount: transactionData.amount,
      b2b: transactionData.b2b,
    }
  }

  return context
}

export type { EvaluationContext }
