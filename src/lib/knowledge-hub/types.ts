// src/lib/knowledge-hub/types.ts

// Changelog types for Living Truth Infrastructure
export type ChangelogSeverity = "breaking" | "critical" | "major" | "minor" | "info"
export type ChangeType = "create" | "update" | "repeal"

// Legacy changelog entry (manual)
export interface LegacyChangelogEntry {
  id: string // Stable slug: "2025-01-15-pdv-threshold"
  date: string // ISO date
  severity: ChangelogSeverity
  summary: string // Human-readable, Croatian
  affectedSections?: string[] // Links to RegulatorySection ids
  sourceRef?: string // Canonical reference
  sourceEvidenceId?: string // Links to Evidence table
  sourcePending?: boolean // True if evidence not yet linked
}

// RTL-generated changelog entry (automated)
export interface RtlChangelogEntry {
  eventId: string // RTL event ID (sha256)
  date: string // ISO date
  severity: ChangelogSeverity
  changeType: ChangeType
  summary: string
  effectiveFrom: string // ISO date
  sourcePointerIds: string[] // RTL source pointer IDs
  primarySourceUrl?: string
  confidenceLevel: number // 0-100
}

// Combined type - supports both legacy and RTL entries
export type ChangelogEntry = LegacyChangelogEntry | RtlChangelogEntry

// Type guards
export function isRtlChangelogEntry(entry: ChangelogEntry): entry is RtlChangelogEntry {
  return "eventId" in entry && "sourcePointerIds" in entry
}

export function isLegacyChangelogEntry(entry: ChangelogEntry): entry is LegacyChangelogEntry {
  return "id" in entry && !("eventId" in entry)
}

// RTL frontmatter section
export interface RtlFrontmatter {
  conceptId: string
  ruleId: string
}

// Validation result type
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export type BusinessType =
  | "pausalni-obrt"
  | "pausalni-obrt-uz-zaposlenje"
  | "pausalni-obrt-umirovljenik"
  | "obrt-dohodak"
  | "obrt-dohodak-uz-zaposlenje"
  | "obrt-dobit"
  | "jdoo"
  | "jdoo-uz-zaposlenje"
  | "doo-jednoclan"
  | "doo-viseclano"
  | "doo-direktor-bez-place"
  | "doo-direktor-s-placom"
  | "slobodna-profesija"
  | "opg"
  | "udruga"
  | "zadruga"
  | "sezonski-obrt"
  | "pausalni-pdv"
  | "it-freelancer"
  | "ugostiteljstvo"

export interface GuideFrontmatter {
  title: string
  description: string
  businessType: BusinessType
  lastUpdated: string
  keywords: string[]
  requiresFiscalization: boolean
  requiresVAT: boolean
  maxRevenue?: number
  changelog?: ChangelogEntry[]
}

export interface WizardAnswer {
  questionId: string
  value: string
}

export interface WizardState {
  currentStep: number
  answers: WizardAnswer[]
  recommendedType?: BusinessType
}

export interface PersonalizationParams {
  prihod?: number
  gotovina?: "da" | "ne"
  zaposlenje?: "da" | "ne"
  nkd?: string
}

export interface ToolPageProps {
  embedded?: boolean
}

export interface FAQ {
  question: string
  answer: string
}

export interface ComparisonFrontmatter {
  title: string
  description: string
  compares: string[] // e.g., ["pausalni", "obrt-dohodak", "jdoo"]
  decisionContext: string // e.g., "starting-solo", "additional-income"
}

// Business type comparison data
export interface BusinessTypeComparison {
  slug: string
  name: string
  maxRevenue: number | null // null = unlimited
  monthlyContributions: number
  taxRate: string // e.g., "~10%" or "20% + prirez"
  vatRequired: boolean
  vatThreshold: number
  fiscalization: boolean
  bookkeeping: "none" | "simple" | "full"
  estimatedBookkeepingCost: number
  bestFor: string[]
  notSuitableFor: string[]
}

// Comparison table row
export interface ComparisonRow {
  label: string
  values: Record<string, string | number | boolean>
  tooltip?: string
}

// Comparison calculator result
export interface ComparisonResult {
  businessType: string
  annualContributions: number
  annualTax: number
  bookkeepingCost: number
  otherCosts: number
  totalCosts: number
  netIncome: number
  isRecommended: boolean
  recommendationReason?: string
}

// New types for content strategy implementation

export interface Source {
  name: string
  url: string
}

export interface FAQItem {
  q: string
  a: string
}

// Extended frontmatter for all content types
export interface ContentFrontmatter {
  title: string
  description: string
  lastUpdated: string
  lastReviewed?: string
  reviewer?: string
  sources?: Source[]
  faq?: FAQItem[]
  keywords?: string[]
}

// Glossary-specific frontmatter
export interface GlossaryFrontmatter extends ContentFrontmatter {
  term: string
  shortDefinition: string
  relatedTerms?: string[]
  appearsIn?: string[] // forms/contexts where term appears
  triggerConditions?: string[] // when user must care about this
}

// How-To specific frontmatter
export interface HowToFrontmatter extends ContentFrontmatter {
  totalTime?: string // ISO 8601 duration, e.g., "PT15M"
  difficulty?: "easy" | "medium" | "hard"
  prerequisites?: string[]
  tools?: string[] // required tools/accounts
}

// Hub page frontmatter
export interface HubFrontmatter extends ContentFrontmatter {
  hubType: "fiskalizacija" | "pdv" | "obrt" | "doo"
  childPages?: string[] // slugs of related pages
}
