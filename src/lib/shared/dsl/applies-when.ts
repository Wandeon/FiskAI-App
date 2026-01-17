// src/lib/shared/dsl/applies-when.ts
// Shared DSL module for rule evaluation - used by both app and workers
import { z } from "zod"
import { Prisma } from "@prisma/client"

const Decimal = Prisma.Decimal

// ReDoS protection constants
const MAX_REGEX_LENGTH = 100
const REGEX_TIMEOUT_MS = 50

/**
 * Safe regex test with ReDoS protection
 */
function safeRegexTest(pattern: string, value: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) {
    console.warn(`[applies-when] Regex pattern too long: ${pattern.length} chars`)
    return false
  }

  try {
    const regex = new RegExp(pattern)
    // Simple patterns should complete quickly
    const start = Date.now()
    const result = regex.test(value)
    const elapsed = Date.now() - start

    if (elapsed > REGEX_TIMEOUT_MS) {
      console.warn(`[applies-when] Slow regex: ${elapsed}ms for pattern "${pattern}"`)
    }

    return result
  } catch {
    return false
  }
}

// Field reference (dot path like "entity.type", "txn.amount")
const fieldRefSchema = z.string().min(1)

// Comparison operators
const cmpOpSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"])

// JSON value - using unknown instead of a specific union to avoid type conflicts
const jsonValueSchema = z.unknown()

// AppliesWhen predicate types
type AppliesWhenPredicate =
  | { op: "and"; args: AppliesWhenPredicate[] }
  | { op: "or"; args: AppliesWhenPredicate[] }
  | { op: "not"; arg: AppliesWhenPredicate }
  | { op: "cmp"; field: string; cmp: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; value: unknown }
  | { op: "in"; field: string; values: unknown[] }
  | { op: "exists"; field: string }
  | { op: "between"; field: string; gte?: unknown; lte?: unknown }
  | { op: "matches"; field: string; pattern: string }
  | { op: "date_in_effect"; dateField: string; on?: string }
  | { op: "true" } // Always true
  | { op: "false" } // Always false

// Zod schema for validation (recursive)
const appliesWhenSchema: z.ZodType<AppliesWhenPredicate> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("and"), args: z.array(appliesWhenSchema) }),
    z.object({ op: z.literal("or"), args: z.array(appliesWhenSchema) }),
    z.object({ op: z.literal("not"), arg: appliesWhenSchema }),
    z.object({
      op: z.literal("cmp"),
      field: fieldRefSchema,
      cmp: cmpOpSchema,
      value: jsonValueSchema,
    }),
    z.object({ op: z.literal("in"), field: fieldRefSchema, values: z.array(jsonValueSchema) }),
    z.object({ op: z.literal("exists"), field: fieldRefSchema }),
    z.object({
      op: z.literal("between"),
      field: fieldRefSchema,
      gte: jsonValueSchema.optional(),
      lte: jsonValueSchema.optional(),
    }),
    z.object({ op: z.literal("matches"), field: fieldRefSchema, pattern: z.string() }),
    z.object({
      op: z.literal("date_in_effect"),
      dateField: fieldRefSchema,
      on: z.string().optional(),
    }),
    z.object({ op: z.literal("true") }),
    z.object({ op: z.literal("false") }),
  ])
)

// Context type for evaluation
interface EvaluationContext {
  asOf: string // ISO date-time
  entity: {
    type: "OBRT" | "DOO" | "JDOO" | "UDRUGA" | "OTHER"
    obrtSubtype?: "PAUSALNI" | "DOHODAS" | "DOBITAS"
    vat: { status: "IN_VAT" | "OUTSIDE_VAT" | "UNKNOWN" }
    activityNkd?: string
    location?: { country: "HR"; county?: string }
  }
  txn?: {
    kind: "SALE" | "PURCHASE" | "PAYMENT" | "PAYROLL" | "OTHER"
    b2b?: boolean
    paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "OTHER"
    amount?: number | string
    currency?: "EUR"
    itemCategory?: string
    date?: string
  }
  counters?: {
    revenueYtd?: number
    invoicesThisMonth?: number
  }
  flags?: {
    isAutomationRequest?: boolean
  }
}

const DECIMAL_STRING_RE = /^-?\d+(?:\.\d+)?$/

function tryParseDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined) return null

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    return new Decimal(value.toString())
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!DECIMAL_STRING_RE.test(trimmed)) return null
    return new Decimal(trimmed)
  }

  if (typeof value === "object" && "toString" in value) {
    const s = String((value as { toString: () => string }).toString()).trim()
    if (!DECIMAL_STRING_RE.test(s)) return null
    return new Decimal(s)
  }

  return null
}

/**
 * Get a value from an object using dot notation path.
 */
function getFieldValue(obj: unknown, path: string): unknown {
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
 * Compare two values with a given operator.
 * Supports numbers and strings (for date comparisons using ISO format).
 */
function compare(
  left: unknown,
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
  right: unknown
): boolean {
  if (left === undefined || left === null) {
    return false // Missing fields always evaluate to false
  }

  const leftDec = tryParseDecimal(left)
  const rightDec = tryParseDecimal(right)

  switch (op) {
    case "eq":
      if (leftDec && rightDec) return leftDec.equals(rightDec)
      return left === right
    case "neq":
      if (leftDec && rightDec) return !leftDec.equals(rightDec)
      return left !== right
    case "gt":
      if (leftDec && rightDec) return leftDec.greaterThan(rightDec)
      if (typeof left === "number" && typeof right === "number") return left > right
      if (typeof left === "string" && typeof right === "string") return left > right
      return false
    case "gte":
      if (leftDec && rightDec) return leftDec.greaterThanOrEqualTo(rightDec)
      if (typeof left === "number" && typeof right === "number") return left >= right
      if (typeof left === "string" && typeof right === "string") return left >= right
      return false
    case "lt":
      if (leftDec && rightDec) return leftDec.lessThan(rightDec)
      if (typeof left === "number" && typeof right === "number") return left < right
      if (typeof left === "string" && typeof right === "string") return left < right
      return false
    case "lte":
      if (leftDec && rightDec) return leftDec.lessThanOrEqualTo(rightDec)
      if (typeof left === "number" && typeof right === "number") return left <= right
      if (typeof left === "string" && typeof right === "string") return left <= right
      return false
    default:
      return false
  }
}

/**
 * Evaluate an AppliesWhen predicate against a context.
 */
export function evaluateAppliesWhen(
  predicate: AppliesWhenPredicate,
  context: EvaluationContext
): boolean {
  switch (predicate.op) {
    case "true":
      return true

    case "false":
      return false

    case "and":
      return predicate.args.every((arg) => evaluateAppliesWhen(arg, context))

    case "or":
      return predicate.args.some((arg) => evaluateAppliesWhen(arg, context))

    case "not":
      return !evaluateAppliesWhen(predicate.arg, context)

    case "cmp": {
      const value = getFieldValue(context, predicate.field)
      return compare(value, predicate.cmp, predicate.value)
    }

    case "in": {
      const value = getFieldValue(context, predicate.field)
      return predicate.values.includes(value)
    }

    case "exists": {
      const value = getFieldValue(context, predicate.field)
      return value !== undefined && value !== null
    }

    case "between": {
      const value = getFieldValue(context, predicate.field)
      const valueDec = tryParseDecimal(value)
      if (!valueDec) return false

      const gteDec = predicate.gte === undefined ? null : tryParseDecimal(predicate.gte)
      const lteDec = predicate.lte === undefined ? null : tryParseDecimal(predicate.lte)
      if (predicate.gte !== undefined && !gteDec) return false
      if (predicate.lte !== undefined && !lteDec) return false

      const gteOk =
        predicate.gte === undefined || (gteDec ? valueDec.greaterThanOrEqualTo(gteDec) : false)
      const lteOk =
        predicate.lte === undefined || (lteDec ? valueDec.lessThanOrEqualTo(lteDec) : false)

      return gteOk && lteOk
    }

    case "matches": {
      const value = getFieldValue(context, predicate.field)
      if (typeof value !== "string") return false
      return safeRegexTest(predicate.pattern, value)
    }

    case "date_in_effect": {
      const dateValue = getFieldValue(context, predicate.dateField)
      if (typeof dateValue !== "string") return false

      const checkDate = predicate.on || context.asOf
      const fieldDate = new Date(dateValue)
      const asOfDate = new Date(checkDate)

      return fieldDate <= asOfDate
    }

    default:
      return false
  }
}

/**
 * Parse and validate an AppliesWhen predicate from JSON or string.
 */
export function parseAppliesWhen(input: string | unknown): AppliesWhenPredicate {
  const parsed = typeof input === "string" ? JSON.parse(input) : input
  return appliesWhenSchema.parse(parsed)
}

/**
 * Validate an AppliesWhen predicate without throwing.
 */
export function validateAppliesWhen(input: unknown): {
  valid: boolean
  error?: string
} {
  const result = appliesWhenSchema.safeParse(input)
  if (result.success) {
    return { valid: true }
  }
  return { valid: false, error: result.error.message }
}

/**
 * Create common predicate helpers.
 */
export const predicates = {
  // Entity type checks
  isObrt: (): AppliesWhenPredicate => ({
    op: "cmp",
    field: "entity.type",
    cmp: "eq",
    value: "OBRT",
  }),

  isPausalni: (): AppliesWhenPredicate => ({
    op: "and",
    args: [
      { op: "cmp", field: "entity.type", cmp: "eq", value: "OBRT" },
      { op: "cmp", field: "entity.obrtSubtype", cmp: "eq", value: "PAUSALNI" },
    ],
  }),

  isOutsideVat: (): AppliesWhenPredicate => ({
    op: "cmp",
    field: "entity.vat.status",
    cmp: "eq",
    value: "OUTSIDE_VAT",
  }),

  // Transaction checks
  isCashSale: (): AppliesWhenPredicate => ({
    op: "and",
    args: [
      { op: "cmp", field: "txn.kind", cmp: "eq", value: "SALE" },
      { op: "in", field: "txn.paymentMethod", values: ["CASH", "CARD"] },
    ],
  }),

  // Threshold checks
  revenueExceeds: (amount: number): AppliesWhenPredicate => ({
    op: "cmp",
    field: "counters.revenueYtd",
    cmp: "gt",
    value: amount,
  }),

  // Always true/false
  always: (): AppliesWhenPredicate => ({ op: "true" }),
  never: (): AppliesWhenPredicate => ({ op: "false" }),
}

export type { AppliesWhenPredicate, EvaluationContext }
export { appliesWhenSchema }
