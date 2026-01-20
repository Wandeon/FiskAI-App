// src/lib/regulatory-truth/eval/context-fields.ts
/**
 * Context Field Registry
 *
 * Central registry of all fields that can appear in evaluation contexts.
 * Prevents the compiler from inventing ad-hoc field names.
 *
 * Each field has:
 * - path: dot-notation path in the context object
 * - type: TypeScript type
 * - description: human-readable description
 * - unit: optional unit (EUR, %, days, etc.)
 */

// =============================================================================
// Field Definitions
// =============================================================================

export interface FieldDefinition {
  path: string
  type: "number" | "boolean" | "string" | "date"
  description: string
  descriptionHr: string
  unit?: string
  required?: boolean
}

/**
 * All known context fields.
 * Add new fields here before using them in rules.
 */
export const CONTEXT_FIELDS: Record<string, FieldDefinition> = {
  // Taxpayer identification
  "taxpayer.country": {
    path: "taxpayer.country",
    type: "string",
    description: "ISO country code of taxpayer residence",
    descriptionHr: "ISO kod države poreznog obveznika",
    required: true,
  },
  "taxpayer.entityType": {
    path: "taxpayer.entityType",
    type: "string",
    description: "Entity type: OBRT, DOO, JDOO, OTHER",
    descriptionHr: "Vrsta subjekta: OBRT, DOO, JDOO, OSTALO",
    required: true,
  },

  // VAT fields
  "taxpayer.vat.annualRevenueEurTrailing12m": {
    path: "taxpayer.vat.annualRevenueEurTrailing12m",
    type: "number",
    description: "Annual revenue in EUR for trailing 12 months",
    descriptionHr: "Godišnji prihod u EUR za zadnjih 12 mjeseci",
    unit: "EUR",
    required: false,
  },
  "taxpayer.vat.annualRevenueEurCalendarYear": {
    path: "taxpayer.vat.annualRevenueEurCalendarYear",
    type: "number",
    description: "Annual revenue in EUR for current calendar year",
    descriptionHr: "Godišnji prihod u EUR za tekuću kalendarsku godinu",
    unit: "EUR",
    required: false,
  },
  "taxpayer.vat.mustRegisterVAT": {
    path: "taxpayer.vat.mustRegisterVAT",
    type: "boolean",
    description: "Whether taxpayer must register for VAT",
    descriptionHr: "Je li porezni obveznik obvezan upisati se u registar PDV-a",
    required: false,
  },
  "taxpayer.vat.isRegistered": {
    path: "taxpayer.vat.isRegistered",
    type: "boolean",
    description: "Whether taxpayer is currently registered for VAT",
    descriptionHr: "Je li porezni obveznik trenutno upisan u registar PDV-a",
    required: false,
  },
} as const

// =============================================================================
// Type Helpers
// =============================================================================

export type ContextFieldPath = keyof typeof CONTEXT_FIELDS

/**
 * Validate that a field path exists in the registry.
 */
export function isValidFieldPath(path: string): path is ContextFieldPath {
  return path in CONTEXT_FIELDS
}

/**
 * Get field definition by path.
 */
export function getFieldDefinition(path: string): FieldDefinition | null {
  return CONTEXT_FIELDS[path] ?? null
}

/**
 * Get all fields for a given prefix (e.g., "taxpayer.vat").
 */
export function getFieldsByPrefix(prefix: string): FieldDefinition[] {
  return Object.values(CONTEXT_FIELDS).filter((f) => f.path.startsWith(prefix))
}

// =============================================================================
// Evaluation Context Type
// =============================================================================

/**
 * The evaluation context passed to the rule evaluator.
 * Mirrors the field registry structure.
 */
export interface EvaluationContext {
  taxpayer: {
    country: string // ISO code, e.g., "HR"
    entityType: "OBRT" | "DOO" | "JDOO" | "OTHER"
    vat?: {
      annualRevenueEurTrailing12m?: number
      annualRevenueEurCalendarYear?: number
      mustRegisterVAT?: boolean
      isRegistered?: boolean
    }
  }
}

/**
 * Get a value from the context by field path.
 */
export function getContextValue(context: EvaluationContext, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = context
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Set a value in the context by field path.
 * Mutates the context object.
 */
export function setContextValue(context: EvaluationContext, path: string, value: unknown): void {
  const parts = path.split(".")
  let current: Record<string, unknown> = context as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || current[part] === null || current[part] === undefined) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}
