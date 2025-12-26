// src/lib/regulatory-truth/schemas/common.ts
import { z } from "zod"

// =============================================================================
// ENUMS (matching Prisma)
// =============================================================================

export const RiskTierSchema = z.enum(["T0", "T1", "T2", "T3"])
export type RiskTier = z.infer<typeof RiskTierSchema>

export const AgentTypeSchema = z.enum([
  "SENTINEL",
  "EXTRACTOR",
  "COMPOSER",
  "REVIEWER",
  "RELEASER",
  "ARBITER",
  "CONTENT_CLASSIFIER",
  "CLAIM_EXTRACTOR",
])
export type AgentType = z.infer<typeof AgentTypeSchema>

export const RuleStatusSchema = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "DEPRECATED",
  "REJECTED",
])
export type RuleStatus = z.infer<typeof RuleStatusSchema>

export const ConflictTypeSchema = z.enum([
  "SOURCE_CONFLICT",
  "TEMPORAL_CONFLICT",
  "SCOPE_CONFLICT",
  "INTERPRETATION_CONFLICT",
])
export type ConflictType = z.infer<typeof ConflictTypeSchema>

// =============================================================================
// DOMAIN TYPES
// =============================================================================

export const DomainSchema = z.enum([
  "pausalni",
  "pdv",
  "porez_dohodak",
  "doprinosi",
  "fiskalizacija",
  "rokovi",
  "obrasci",
])
export type Domain = z.infer<typeof DomainSchema>

export const ValueTypeSchema = z.enum([
  "currency",
  "percentage",
  "date",
  "threshold",
  "text",
  "currency_hrk",
  "currency_eur",
  "count",
])
export type ValueType = z.infer<typeof ValueTypeSchema>

export const ContentTypeSchema = z.enum(["html", "pdf", "xml"])
export type ContentType = z.infer<typeof ContentTypeSchema>

// =============================================================================
// CONFIDENCE THRESHOLDS
// =============================================================================

export const CONFIDENCE_THRESHOLDS = {
  T0: 0.99,
  T1: 0.95,
  T2: 0.9,
  T3: 0.85,
} as const

export const AUTO_APPROVE_THRESHOLDS = {
  T0: Infinity, // Never auto-approve
  T1: Infinity, // Never auto-approve
  T2: 0.95,
  T3: 0.9,
} as const

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

export const ConfidenceSchema = z.number().min(0).max(1)

export const ISODateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date format YYYY-MM-DD")

export const ISOTimestampSchema = z.string().datetime()

export const URLSchema = z.string().url()
