// src/lib/shared/dsl/outcome.ts
// Shared DSL module for rule outcomes - used by both app and workers
import { z } from "zod"

// Deadline types
const deadlineSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FIXED"),
    date: z.string(), // ISO date
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("RELATIVE"),
    days: z.number(),
    from: z.enum(["txn_date", "month_end", "quarter_end", "year_end", "event"]),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("RECURRING"),
    day: z.number().min(1).max(31),
    frequency: z.enum(["monthly", "quarterly", "yearly"]),
    description: z.string().optional(),
  }),
])

// Step in a procedure
const stepSchema = z.object({
  title: z.string(),
  details: z.string().optional(),
  system: z.string().optional(), // e.g., "e-Porezna", "FINA"
  url: z.string().optional(),
})

// Outcome types
const outcomeSchema = z.discriminatedUnion("kind", [
  // VALUE: A specific regulatory value (rate, threshold, amount)
  z.object({
    kind: z.literal("VALUE"),
    value: z.union([z.string(), z.number(), z.boolean()]),
    unit: z.string().optional(), // e.g., "EUR", "%", "days"
    format: z.string().optional(), // e.g., "currency", "percentage"
  }),

  // OBLIGATION: Something the entity must do
  z.object({
    kind: z.literal("OBLIGATION"),
    obligation: z.object({
      code: z.string(), // e.g., "SUBMIT_PDV", "ISSUE_E_INVOICE"
      description: z.string(),
      deadline: deadlineSchema.optional(),
      steps: z.array(stepSchema).optional(),
      penalty: z.string().optional(),
    }),
  }),

  // PROCEDURE: How to do something
  z.object({
    kind: z.literal("PROCEDURE"),
    procedure: z.object({
      system: z.enum(["FINA", "POREZNA", "HZMO", "HZZO", "SUDSKI_REGISTAR", "OTHER"]),
      action: z.string(),
      url: z.string().optional(),
      payloadSchema: z.unknown().optional(),
      steps: z.array(stepSchema).optional(),
    }),
  }),
])

type Outcome = z.infer<typeof outcomeSchema>
type Deadline = z.infer<typeof deadlineSchema>
type Step = z.infer<typeof stepSchema>

/**
 * Parse and validate an Outcome from JSON.
 */
export function parseOutcome(input: string | unknown): Outcome {
  const parsed = typeof input === "string" ? JSON.parse(input) : input
  return outcomeSchema.parse(parsed)
}

/**
 * Validate an Outcome without throwing.
 */
export function validateOutcome(input: unknown): {
  valid: boolean
  error?: string
} {
  const result = outcomeSchema.safeParse(input)
  if (result.success) {
    return { valid: true }
  }
  return { valid: false, error: result.error.message }
}

/**
 * Create common outcome helpers.
 */
export const outcomes = {
  // Value outcomes
  percentage: (value: number): Outcome => ({
    kind: "VALUE",
    value,
    unit: "%",
    format: "percentage",
  }),

  currency: (value: number, unit: "EUR" | "HRK" = "EUR"): Outcome => ({
    kind: "VALUE",
    value,
    unit,
    format: "currency",
  }),

  threshold: (value: number, unit: string): Outcome => ({
    kind: "VALUE",
    value,
    unit,
    format: "number",
  }),

  // Obligation outcomes
  submitForm: (code: string, description: string, deadline?: Deadline): Outcome => ({
    kind: "OBLIGATION",
    obligation: {
      code,
      description,
      deadline,
    },
  }),

  // Procedure outcomes
  procedure: (
    system: "FINA" | "POREZNA" | "HZMO" | "HZZO" | "SUDSKI_REGISTAR" | "OTHER",
    action: string,
    steps?: Step[]
  ): Outcome => ({
    kind: "PROCEDURE",
    procedure: {
      system,
      action,
      steps,
    },
  }),
}

export type { Outcome, Deadline, Step }
export { outcomeSchema, deadlineSchema, stepSchema }
