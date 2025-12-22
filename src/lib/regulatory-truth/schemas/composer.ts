// src/lib/regulatory-truth/schemas/composer.ts
import { z } from "zod"
import { RiskTierSchema, ValueTypeSchema, ConfidenceSchema, ISODateSchema } from "./common"

// =============================================================================
// COMPOSER INPUT
// =============================================================================

export const ComposerInputSchema = z.object({
  sourcePointerIds: z.array(z.string()).min(1),
  sourcePointers: z.array(
    z.object({
      id: z.string(),
      domain: z.string(),
      extractedValue: z.string(),
      exactQuote: z.string(),
      confidence: z.number(),
    })
  ),
})
export type ComposerInput = z.infer<typeof ComposerInputSchema>

// =============================================================================
// DRAFT RULE
// =============================================================================

// Preprocess applies_when: LLM may return object (DSL) or string (serialized DSL)
// Must handle all edge cases robustly since LLM output varies
const appliesWhenSchema = z.preprocess((val) => {
  // Already a string - pass through
  if (typeof val === "string") return val
  // Null/undefined - default to empty object DSL
  if (val === null || val === undefined) return '{"always": true}'
  // Object - stringify it
  if (typeof val === "object") {
    try {
      return JSON.stringify(val)
    } catch {
      // If stringify fails (circular refs, etc), use fallback
      return '{"always": true}'
    }
  }
  // Anything else - convert to string
  return String(val)
}, z.string().min(1))

// Preprocess effective_from: ensure it's never null (use current date as fallback)
const effectiveFromSchema = z.preprocess((val) => {
  if (val === null || val === undefined) {
    return new Date().toISOString().split("T")[0]
  }
  // If it's a string, pass through
  if (typeof val === "string") return val
  // If it's a Date object, convert to ISO date string
  if (val instanceof Date) return val.toISOString().split("T")[0]
  // Anything else, try to convert
  return String(val)
}, ISODateSchema)

export const DraftRuleSchema = z.object({
  concept_slug: z.string().regex(/^[a-z0-9-]+$/, "Must be kebab-case"),
  title_hr: z.string().min(1),
  title_en: z.string().min(1),
  risk_tier: RiskTierSchema,
  applies_when: appliesWhenSchema, // AppliesWhen DSL expression (string or object auto-stringified)
  value: z.union([z.string(), z.number()]),
  value_type: ValueTypeSchema,
  explanation_hr: z.string(),
  explanation_en: z.string(),
  source_pointer_ids: z.array(z.string()).min(1),
  effective_from: effectiveFromSchema,
  effective_until: ISODateSchema.nullable(),
  supersedes: z.string().nullable(),
  confidence: ConfidenceSchema,
  composer_notes: z.string(),
})
export type DraftRule = z.infer<typeof DraftRuleSchema>

// =============================================================================
// CONFLICT DETECTION
// =============================================================================

export const ConflictDetectedSchema = z.object({
  description: z.string(),
  conflicting_sources: z.array(z.string()),
  escalate_to_arbiter: z.literal(true),
})
export type ConflictDetected = z.infer<typeof ConflictDetectedSchema>

// =============================================================================
// COMPOSER OUTPUT
// =============================================================================

export const ComposerOutputSchema = z.object({
  draft_rule: DraftRuleSchema,
  conflicts_detected: ConflictDetectedSchema.optional(),
})
export type ComposerOutput = z.infer<typeof ComposerOutputSchema>

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validateComposerOutput(data: unknown): ComposerOutput {
  return ComposerOutputSchema.parse(data)
}

export function isComposerOutputValid(data: unknown): data is ComposerOutput {
  return ComposerOutputSchema.safeParse(data).success
}
