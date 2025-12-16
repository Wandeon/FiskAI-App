// src/lib/knowledge-hub/types.ts

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
