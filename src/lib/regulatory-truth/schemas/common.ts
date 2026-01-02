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
  "PROCESS_EXTRACTOR",
  "REFERENCE_EXTRACTOR",
  "ASSET_EXTRACTOR",
  "TRANSITIONAL_EXTRACTOR",
  "COMPARISON_EXTRACTOR",
  "QUERY_CLASSIFIER",
  "EXEMPTION_EXTRACTOR",
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

export const ConflictStatusSchema = z.enum(["OPEN", "RESOLVED", "ESCALATED"])
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>

// =============================================================================
// REGULATORY RULE ENUMS (matching Prisma)
// =============================================================================

export const AuthorityLevelSchema = z.enum(["LAW", "GUIDANCE", "PROCEDURE", "PRACTICE"])
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>

export const AutomationPolicySchema = z.enum(["ALLOW", "CONFIRM", "BLOCK"])
export type AutomationPolicy = z.infer<typeof AutomationPolicySchema>

export const RuleStabilitySchema = z.enum(["STABLE", "VOLATILE"])
export type RuleStability = z.infer<typeof RuleStabilitySchema>

export const ObligationTypeSchema = z.enum([
  "OBLIGATION",
  "NO_OBLIGATION",
  "CONDITIONAL",
  "INFORMATIONAL",
])
export type ObligationType = z.infer<typeof ObligationTypeSchema>

export const GraphEdgeTypeSchema = z.enum([
  "AMENDS",
  "INTERPRETS",
  "REQUIRES",
  "EXEMPTS",
  "DEPENDS_ON",
  "SUPERSEDES",
  "OVERRIDES",
])
export type GraphEdgeType = z.infer<typeof GraphEdgeTypeSchema>

// =============================================================================
// ALERT ENUMS (matching Prisma)
// =============================================================================

export const AlertSeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>

export const AlertTypeSchema = z.enum([
  "SOURCE_CHANGED",
  "SOURCE_UNAVAILABLE",
  "RULE_SUPERSEDED",
  "CONFLICT_DETECTED",
  "DEADLINE_APPROACHING",
  "CONFIDENCE_DEGRADED",
  "COVERAGE_GAP",
])
export type AlertType = z.infer<typeof AlertTypeSchema>

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
  "exemptions",
  "references",
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
  "cross_reference",
  "exemption_condition",
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

// =============================================================================
// DOMAIN VALIDATION
// =============================================================================

/**
 * Validate that a domain is one of the standard domains defined in DomainSchema.
 * This prevents domain leakage where non-standard domains end up in the database.
 *
 * @param domain - The domain string to validate
 * @returns true if the domain is valid, false otherwise
 */
export function isValidDomain(domain: string): boolean {
  const validDomains = DomainSchema.options
  return (validDomains as readonly string[]).includes(domain)
}

/**
 * Get list of all valid domains
 */
export function getValidDomains(): readonly string[] {
  return DomainSchema.options
}
