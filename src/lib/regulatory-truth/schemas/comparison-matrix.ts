// src/lib/regulatory-truth/schemas/comparison-matrix.ts
import { z } from "zod"

/**
 * Schema for comparison options (columns in matrix)
 */
export const ComparisonOptionSchema = z.object({
  slug: z.string().min(1),
  conceptId: z.string().min(1), // Links to ConceptNode
  nameHr: z.string().min(1),
  nameEn: z.string().optional(),
  description: z.string().optional(),
})

export type ComparisonOption = z.infer<typeof ComparisonOptionSchema>

/**
 * Schema for comparison criteria (rows in matrix)
 */
export const ComparisonCriterionSchema = z.object({
  slug: z.string().min(1),
  conceptId: z.string().min(1), // Links to ConceptNode
  nameHr: z.string().min(1),
  nameEn: z.string().optional(),
  weight: z.number().min(0).max(1).optional(), // For optional scoring
})

export type ComparisonCriterion = z.infer<typeof ComparisonCriterionSchema>

/**
 * Schema for matrix cells (intersection of option and criterion)
 */
export const ComparisonCellSchema = z.object({
  optionSlug: z.string().min(1),
  criterionSlug: z.string().min(1),
  value: z.string().min(1),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  explanation: z.string().optional(),
})

export type ComparisonCell = z.infer<typeof ComparisonCellSchema>

/**
 * Full ComparisonMatrix schema for extraction
 */
export const ComparisonMatrixSchema = z.object({
  slug: z.string().min(1),
  titleHr: z.string().min(1),
  titleEn: z.string().optional(),

  // Contextual anchor
  appliesWhen: z.string().optional(),
  domainTags: z.array(z.string()).default([]),

  // Matrix structure
  options: z.array(ComparisonOptionSchema).min(2), // At least 2 options to compare
  criteria: z.array(ComparisonCriterionSchema).min(1), // At least 1 criterion
  cells: z.array(ComparisonCellSchema).min(1),

  // Optional conclusion
  conclusion: z.string().optional(),
})

export type ComparisonMatrix = z.infer<typeof ComparisonMatrixSchema>

/**
 * Schema for extraction output (includes confidence)
 */
export const ComparisonMatrixExtractionSchema = ComparisonMatrixSchema.extend({
  confidence: z.number().min(0).max(1).default(0.8),
  evidenceId: z.string().optional(),
})

export type ComparisonMatrixExtraction = z.infer<typeof ComparisonMatrixExtractionSchema>

/**
 * Domain tags for categorization
 */
export const COMPARISON_DOMAIN_TAGS = [
  "STARTING_BUSINESS",
  "TAX_REGIME",
  "VAT_SCHEME",
  "EMPLOYMENT",
  "RETIREMENT",
  "INVESTMENT",
  "LEGAL_FORM",
] as const

export type ComparisonDomainTag = (typeof COMPARISON_DOMAIN_TAGS)[number]
