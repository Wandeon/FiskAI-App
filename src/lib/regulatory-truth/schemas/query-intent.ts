// src/lib/regulatory-truth/schemas/query-intent.ts
import { z } from "zod"

export const QueryIntentSchema = z.enum([
  "LOGIC", // "Do I owe VAT if...", "What is the tax rate for..."
  "PROCESS", // "How do I register...", "What are the steps..."
  "REFERENCE", // "What is the IBAN for...", "What is the code for..."
  "DOCUMENT", // "Where can I find the form...", "Download PDV-P"
  "TEMPORAL", // "Which rate applies for June invoice...", "Old vs new rule"
  "STRATEGY", // "Should I open d.o.o. or obrt?", "Trebam li paušalni?"
  "GENERAL", // General questions, explanations
])

export const QueryClassificationSchema = z.object({
  intent: QueryIntentSchema,
  confidence: z.number().min(0).max(1),
  extractedEntities: z.object({
    subjects: z.array(z.string()).default([]), // taxpayer types
    conditions: z.array(z.string()).default([]), // thresholds, dates
    products: z.array(z.string()).default([]), // product categories
    locations: z.array(z.string()).default([]), // cities, regions
    dates: z.array(z.string()).default([]), // specific dates
    formCodes: z.array(z.string()).default([]), // PDV-P, JOPPD
  }),
  suggestedEngines: z.array(z.string()).min(1),
  reasoning: z.string(),
})

export type QueryIntent = z.infer<typeof QueryIntentSchema>
export type QueryClassification = z.infer<typeof QueryClassificationSchema>
export type ExtractedEntities = QueryClassification["extractedEntities"]
