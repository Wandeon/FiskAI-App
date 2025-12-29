/**
 * User Segmentation System Types
 *
 * Unified segmentation for feature targeting, experiments, and cohort analysis.
 * Segments are defined using a rules DSL that evaluates company attributes.
 */

// Operators defined locally to avoid circular dependencies with prisma client
// These match the Prisma enums defined in schema.prisma
export type SegmentOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IN"
  | "NOT_IN"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "IS_NULL"
  | "IS_NOT_NULL"

export type SegmentLogicOperator = "AND" | "OR"

/**
 * Segmentable company attributes - fields that can be used in segment rules
 */
export const SEGMENTABLE_FIELDS = {
  // Company identity
  legalForm: {
    type: "string" as const,
    label: "Legal Form",
    description: "Company legal structure (OBRT_PAUSAL, OBRT_REAL, DOO, JDOO, etc.)",
    options: ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "DOO", "JDOO"],
  },
  isVatPayer: {
    type: "boolean" as const,
    label: "VAT Payer",
    description: "Whether the company is registered for VAT",
  },
  country: {
    type: "string" as const,
    label: "Country",
    description: "Company country code",
  },

  // Subscription
  subscriptionStatus: {
    type: "string" as const,
    label: "Subscription Status",
    description: "Current subscription status",
    options: ["trialing", "active", "past_due", "canceled", "unpaid"],
  },
  subscriptionPlan: {
    type: "string" as const,
    label: "Subscription Plan",
    description: "Current subscription plan",
    options: ["free", "starter", "pausalni", "professional", "enterprise"],
  },
  trialEndsAt: {
    type: "date" as const,
    label: "Trial End Date",
    description: "When the trial period ends",
  },

  // Usage & limits
  invoiceLimit: {
    type: "number" as const,
    label: "Invoice Limit",
    description: "Maximum invoices allowed",
  },
  userLimit: {
    type: "number" as const,
    label: "User Limit",
    description: "Maximum users allowed",
  },

  // Features
  fiscalEnabled: {
    type: "boolean" as const,
    label: "Fiscal Enabled",
    description: "Whether fiscalization is enabled",
  },

  // Dates
  createdAt: {
    type: "date" as const,
    label: "Created At",
    description: "When the company was created",
  },

  // Entitlements (special handling - checks if module is in entitlements array)
  hasModule: {
    type: "module" as const,
    label: "Has Module",
    description: "Whether company has a specific module enabled",
    options: [
      "invoicing",
      "e-invoicing",
      "fiscalization",
      "contacts",
      "products",
      "expenses",
      "banking",
      "reconciliation",
      "reports-basic",
      "reports-advanced",
      "pausalni",
      "vat",
      "corporate-tax",
      "pos",
      "documents",
      "ai-assistant",
    ],
  },
} as const

export type SegmentableField = keyof typeof SEGMENTABLE_FIELDS
export type FieldType = "string" | "number" | "boolean" | "date" | "module"

/**
 * A single condition in a segment rule
 */
export interface SegmentCondition {
  field: SegmentableField
  operator: SegmentOperator
  value: string | number | boolean | string[] | number[] | null
}

/**
 * Segment rules - a logical expression of conditions
 */
export interface SegmentRules {
  operator: SegmentLogicOperator
  conditions: (SegmentCondition | SegmentRules)[]
}

/**
 * Company attributes used for segment evaluation
 */
export interface CompanyAttributes {
  id: string
  legalForm: string | null
  isVatPayer: boolean
  country: string
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  trialEndsAt: Date | null
  invoiceLimit: number
  userLimit: number
  fiscalEnabled: boolean
  createdAt: Date
  entitlements: string[] | null
}

/**
 * Result of segment evaluation
 */
export interface SegmentEvaluationResult {
  segmentId: string
  segmentName: string
  matches: boolean
  evaluatedAt: Date
  matchedConditions?: string[]
  failedConditions?: string[]
}

/**
 * Segment with resolved member count
 */
export interface SegmentWithStats {
  id: string
  name: string
  description: string | null
  status: string
  rules: SegmentRules
  memberCount: number
  lastEvaluatedAt: Date | null
  category: string | null
  tags: string[]
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Pre-defined system segments
 */
export const SYSTEM_SEGMENTS: Array<{
  name: string
  description: string
  category: string
  rules: SegmentRules
}> = [
  {
    name: "pausalni_non_vat",
    description: "Pauscal businesses that are not VAT payers",
    category: "legal_form",
    rules: {
      operator: "AND",
      conditions: [
        { field: "legalForm", operator: "EQUALS", value: "OBRT_PAUSAL" },
        { field: "isVatPayer", operator: "EQUALS", value: false },
      ],
    },
  },
  {
    name: "pausalni_vat",
    description: "Pauscal businesses that are VAT payers",
    category: "legal_form",
    rules: {
      operator: "AND",
      conditions: [
        { field: "legalForm", operator: "IN", value: ["OBRT_PAUSAL", "OBRT_VAT"] },
        { field: "isVatPayer", operator: "EQUALS", value: true },
      ],
    },
  },
  {
    name: "real_income",
    description: "Businesses with real income taxation (Obrt - stvarni dohodak)",
    category: "legal_form",
    rules: {
      operator: "AND",
      conditions: [{ field: "legalForm", operator: "EQUALS", value: "OBRT_REAL" }],
    },
  },
  {
    name: "corporate",
    description: "Corporate entities (DOO and JDOO)",
    category: "legal_form",
    rules: {
      operator: "AND",
      conditions: [{ field: "legalForm", operator: "IN", value: ["DOO", "JDOO"] }],
    },
  },
  {
    name: "active_trial",
    description: "Companies currently in trial period",
    category: "subscription",
    rules: {
      operator: "AND",
      conditions: [{ field: "subscriptionStatus", operator: "EQUALS", value: "trialing" }],
    },
  },
  {
    name: "paid_subscribers",
    description: "Companies with active paid subscriptions",
    category: "subscription",
    rules: {
      operator: "AND",
      conditions: [
        { field: "subscriptionStatus", operator: "EQUALS", value: "active" },
        { field: "subscriptionPlan", operator: "NOT_EQUALS", value: "free" },
      ],
    },
  },
  {
    name: "fiscal_users",
    description: "Companies with fiscalization enabled",
    category: "features",
    rules: {
      operator: "AND",
      conditions: [{ field: "fiscalEnabled", operator: "EQUALS", value: true }],
    },
  },
  {
    name: "ai_users",
    description: "Companies with AI assistant module",
    category: "features",
    rules: {
      operator: "AND",
      conditions: [{ field: "hasModule", operator: "EQUALS", value: "ai-assistant" }],
    },
  },
]
