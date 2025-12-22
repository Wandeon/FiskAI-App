// src/lib/regulatory-truth/schemas/extractor.ts
import { z } from "zod"
import { DomainSchema, ValueTypeSchema, ConfidenceSchema } from "./common"

// =============================================================================
// EXTRACTOR INPUT
// =============================================================================

export const ExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  contentType: z.enum(["html", "pdf", "xml"]),
  sourceUrl: z.string().url(),
})
export type ExtractorInput = z.infer<typeof ExtractorInputSchema>

// =============================================================================
// EXTRACTION ITEM
// =============================================================================

export const ExtractionItemSchema = z.object({
  id: z.string().nullish().default(""),
  domain: DomainSchema,
  value_type: ValueTypeSchema,
  extracted_value: z.union([z.string(), z.number()]),
  display_value: z.string().nullish().default(""),
  exact_quote: z.string().min(1),
  context_before: z.string().nullish().default(""),
  context_after: z.string().nullish().default(""),
  selector: z.string().nullish().default(""),
  confidence: ConfidenceSchema,
  extraction_notes: z.string().nullish().default(""),
})
export type ExtractionItem = z.infer<typeof ExtractionItemSchema>

// =============================================================================
// EXTRACTOR OUTPUT
// =============================================================================

export const ExtractorOutputSchema = z.object({
  // Make evidence_id optional - we can fill it from input if missing
  evidence_id: z.string().optional(),
  // Extractions array is required but can be empty
  extractions: z.array(ExtractionItemSchema).default([]),
  // Make metadata optional with sensible defaults
  extraction_metadata: z
    .object({
      total_extractions: z.number().int().min(0).default(0),
      by_domain: z.record(z.string(), z.number()).default({}),
      low_confidence_count: z.number().int().min(0).default(0),
      processing_notes: z.string().default(""),
    })
    .default({
      total_extractions: 0,
      by_domain: {},
      low_confidence_count: 0,
      processing_notes: "",
    }),
})
export type ExtractorOutput = z.infer<typeof ExtractorOutputSchema>

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validateExtractorOutput(data: unknown): ExtractorOutput {
  return ExtractorOutputSchema.parse(data)
}

export function isExtractorOutputValid(data: unknown): data is ExtractorOutput {
  return ExtractorOutputSchema.safeParse(data).success
}
