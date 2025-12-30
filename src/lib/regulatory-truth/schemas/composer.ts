// src/lib/regulatory-truth/schemas/composer.ts
import { z } from "zod"
import {
  RiskTierSchema,
  ValueTypeSchema,
  ConfidenceSchema,
  ISODateSchema,
  AuthorityLevelSchema,
  AutomationPolicySchema,
  RuleStabilitySchema,
  ObligationTypeSchema,
} from "./common"

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
// FAIL-CLOSED: Invalid DSL must NOT silently become "always true" (PR #89 CRIT fix)
// If DSL is invalid, the rule creation will be rejected in composer.ts
const appliesWhenSchema = z.preprocess((val) => {
  // Already a string - pass through (will be validated later)
  if (typeof val === "string") return val
  // Null/undefined - mark as invalid (will be caught by composer validation)
  // Previously returned '{"always": true}' which silently broadened applicability
  if (val === null || val === undefined) return '{"op": "INVALID_NULL_DSL"}'
  // Object - stringify it
  if (typeof val === "object") {
    try {
      return JSON.stringify(val)
    } catch {
      // If stringify fails (circular refs, etc), mark as invalid
      // Previously returned '{"always": true}' which silently broadened applicability
      return '{"op": "INVALID_STRINGIFY_FAILED"}'
    }
  }
  // Anything else - convert to string (will be validated later)
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
  // Optional fields matching Prisma RegulatoryRule defaults
  authority_level: AuthorityLevelSchema.optional().default("GUIDANCE"),
  automation_policy: AutomationPolicySchema.optional().default("CONFIRM"),
  rule_stability: RuleStabilitySchema.optional().default("STABLE"),
  obligation_type: ObligationTypeSchema.optional().default("OBLIGATION"),
  outcome: z.record(z.string(), z.unknown()).nullable().optional(), // Prisma: Json?
  applies_when: appliesWhenSchema, // AppliesWhen DSL expression (string or object auto-stringified)
  value: z.union([z.string(), z.number()]),
  value_type: ValueTypeSchema,
  explanation_hr: z.string(),
  explanation_en: z.string(),
  source_pointer_ids: z.array(z.string()).min(1),
  effective_from: effectiveFromSchema,
  effective_until: ISODateSchema.nullable(),
  supersedes: z.string().nullable(),
  llm_confidence: ConfidenceSchema, // LLM's self-assessed confidence (Issue #770)
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
