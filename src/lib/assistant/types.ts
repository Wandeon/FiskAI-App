// === SCHEMA METADATA ===
export const SCHEMA_VERSION = "1.0.0" as const

// === ERROR TYPES ===
export const ERROR_TYPES = [
  "NETWORK_TIMEOUT",
  "NETWORK_FAILURE",
  "SERVER_ERROR",
  "CLIENT_ERROR",
  "SCHEMA_VALIDATION",
  "RATE_LIMITED",
] as const

export type ErrorType = (typeof ERROR_TYPES)[number]

export interface AssistantError {
  type: ErrorType
  message: string
  httpStatus?: number
}

// === LENGTH BUDGETS (Server-Enforced) ===
export const LIMITS = {
  // Per-field caps
  headline: 120,
  directAnswer: 240,
  keyDetailItem: 120,
  keyDetailCount: 3,
  nextStep: 100,

  // Why drawer
  whyBulletItem: 140,
  whyBulletCount: 5,
  whyTotalChars: 700,

  // Citations
  citationsMax: 4,
  quoteExcerpt: 240,
  citationsTotalChars: 1200,

  // Client context
  computedResultExplanation: 200,

  // Related
  relatedQuestionsMax: 4,
  relatedQuestionLength: 80,

  // Total payload
  totalResponseChars: 3500,
} as const

// === AUTHORITY ORDER (FROZEN - Do not modify) ===
export const AUTHORITY_ORDER = ["LAW", "REGULATION", "GUIDANCE", "PRACTICE"] as const
export type AuthorityLevel = (typeof AUTHORITY_ORDER)[number]

export const AUTHORITY_RANK: Record<AuthorityLevel, number> = {
  LAW: 1,
  REGULATION: 2,
  GUIDANCE: 3,
  PRACTICE: 4,
}

// === REFUSAL REASONS ===
export type RefusalReason =
  | "NO_CITABLE_RULES"
  | "OUT_OF_SCOPE"
  | "MISSING_CLIENT_DATA"
  | "UNRESOLVED_CONFLICT"
  | "NEEDS_CLARIFICATION"
  | "UNSUPPORTED_JURISDICTION"

// === SURFACE & TOPIC ===
export type Surface = "MARKETING" | "APP"
export type Topic = "REGULATORY" | "PRODUCT" | "SUPPORT" | "OFFTOPIC"
export type ResponseKind = "ANSWER" | "REFUSAL" | "ERROR"

// === SOURCE CARD ===
export interface SourceCard {
  id: string
  title: string
  authority: AuthorityLevel
  reference?: string
  quote?: string
  pageNumber?: number
  url: string
  effectiveFrom: string | null // Date source became effective; null if unknown
  confidence: number
  status?: "ACTIVE" | "SUPERSEDED"
  // Evidence provenance (required for primary, optional for supporting)
  evidenceId?: string
  fetchedAt?: string | null // When evidence was fetched; null if unknown (never fabricate)
  // Freshness metadata (GitHub issue #158)
  freshnessStatus?: "fresh" | "aging" | "stale" | "critical"
  freshnessWarning?: string // User-facing warning message
  daysSinceFetch?: number // Age in days for transparency
}

/**
 * Primary SourceCard has stricter requirements.
 * quote, url, evidenceId, and fetchedAt are all required.
 */
export interface PrimarySourceCard extends SourceCard {
  quote: string
  evidenceId: string
  fetchedAt: string
}

// === CITATION BLOCK ===
export interface CitationBlock {
  primary: SourceCard
  supporting: SourceCard[]
}

// === CLIENT CONTEXT ===
export interface DataPoint {
  label: string
  value: string
  source: string
  asOfDate?: string
}

export interface MissingData {
  label: string
  impact: string
  connectAction?: string
}

export type CompletenessStatus = "COMPLETE" | "PARTIAL" | "NONE"

export interface ClientContextBlock {
  used: DataPoint[]
  completeness: {
    status: CompletenessStatus
    score: number
    notes?: string
  }
  assumptions?: string[]
  missing?: MissingData[]
  computedResult?: {
    label: string
    value: string
    explanation?: string
  }
}

// === CONFLICT BLOCK ===
export type ConflictStatus = "RESOLVED" | "UNRESOLVED" | "CONTEXT_DEPENDENT"

export interface ConflictBlock {
  status: ConflictStatus
  resolvedAt?: string
  description: string
  sources: SourceCard[]
  winningSourceId?: string
}

// === REFUSAL BLOCK ===
export interface RedirectOption {
  label: string
  href: string
  type: "SUPPORT" | "DOCS" | "CONTACT"
}

export interface RefusalBlock {
  message: string
  relatedTopics?: string[]
  redirectOptions?: RedirectOption[]
  missingData?: MissingData[]
  conflictingSources?: SourceCard[]
}

// === DEBUG BLOCK (non-production only) ===
export interface DebugBlock {
  latencyMs: number
  rulesConsidered: number
  rulesUsed: number
  conflictsOpen: number
  pipelineStages?: string[]
}

// === DISCLAIMER (Appendix A: Safe Human-Removal Policy) ===
export interface Disclaimer {
  /** Always-visible short disclaimer */
  short: string
  /** Expanded disclaimer shown on hover/click */
  expanded: string
  /** High-risk warning for T0/T1 rules (null if not applicable) */
  highRiskWarning: string | null
}

/** Standard disclaimer for autonomous guidance (Appendix A) */
export const STANDARD_DISCLAIMER: Disclaimer = {
  short:
    "Autonomna regulatorna smjernica. Provjereno prema izvornom tekstu; može zahtijevati stručnu potvrdu.",
  expanded:
    "Ova smjernica je generirana autonomnim sustavom koji verificira navode prema službenim izvorima. Nije pravni savjet. Za odluke od velikog značaja, konzultirajte licenciranog stručnjaka.",
  highRiskWarning: null,
}

/** High-risk disclaimer for T0/T1 rules (Appendix A) */
export const HIGH_RISK_DISCLAIMER: Disclaimer = {
  short:
    "Autonomna regulatorna smjernica. Provjereno prema izvornom tekstu; može zahtijevati stručnu potvrdu.",
  expanded:
    "Ova smjernica je generirana autonomnim sustavom koji verificira navode prema službenim izvorima. Nije pravni savjet. Za odluke od velikog značaja, konzultirajte licenciranog stručnjaka.",
  highRiskWarning:
    "Pravilo visokog utjecaja. Verificirajte prema službenom izvoru ili konzultirajte računovođu.",
}

// === CONFIDENCE ===
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

export interface ConfidenceBreakdown {
  queryConfidence: number // 0-1, how well we understood the query
  evidenceQuality: number // 0-1, overall evidence quality score
  evidenceFactors: {
    freshness: number // 0-1, based on evidence age
    sourceCount: number // 0-1, based on number of corroborating sources
    authorityWeight: number // 0-1, based on authority level
    quoteQuality: number // 0-1, based on quote match quality
    temporalMargin: number // 0-1, based on distance to effectiveUntil
  }
  evidenceDetails: {
    freshnessAgeInDays: number // -1 if unknown
    sourceCount: number
    authorityLevel: string
    hasExactQuote: boolean
    daysUntilExpiration: number | null // null if no expiration
  }
}

export interface Confidence {
  level: ConfidenceLevel
  score?: number
  rationale?: string
  breakdown?: ConfidenceBreakdown
}

// === OBLIGATION TYPE ===
export type ObligationType = "OBLIGATION" | "NO_OBLIGATION" | "CONDITIONAL" | "INFORMATIONAL"

export type ObligationBadgeLevel = "high" | "medium" | "low" | "none"

export interface ObligationBadge {
  text: string
  level: ObligationBadgeLevel
}

export interface ObligationContext {
  type: ObligationType
  badge: ObligationBadge
  clarification?: string
}

// === MISSING CONTEXT BLOCK ===
export interface MissingContextBlock {
  ruleCount: number
  message: string
}

// === CORE RESPONSE ===
export interface AssistantResponse {
  // Schema & tracing
  schemaVersion: typeof SCHEMA_VERSION
  requestId: string
  traceId: string

  // Classification
  kind: ResponseKind
  topic: Topic
  surface: Surface
  createdAt: string

  // Answer content
  headline: string
  directAnswer: string
  keyDetails?: string[]
  nextStep?: string
  asOfDate?: string
  confidence?: Confidence

  // Drawers
  why?: { bullets: string[] }
  howToApply?: { steps: string[] }

  // Citations
  citations?: CitationBlock

  // Client context (APP only)
  clientContext?: ClientContextBlock

  // Obligation context (for semantic differentiation)
  obligationContext?: ObligationContext

  // Missing context (rules excluded due to missing data)
  missingContext?: MissingContextBlock

  // Conflict
  conflict?: ConflictBlock

  // Refusal
  refusalReason?: RefusalReason
  refusal?: RefusalBlock

  // Error
  error?: {
    message: string
    retriable: boolean
  }

  // Follow-up
  relatedQuestions?: string[]

  // Disclaimer (Appendix A: Safe Human-Removal Policy)
  disclaimer?: Disclaimer

  // Debug (non-production)
  _debug?: DebugBlock
}

// === CONTROLLER STATES ===
export const CONTROLLER_STATES = [
  "IDLE",
  "LOADING",
  "STREAMING",
  "COMPLETE",
  "PARTIAL_COMPLETE",
  "ERROR",
] as const

export type ControllerStatus = (typeof CONTROLLER_STATES)[number]

// === HISTORY ITEM ===
export interface HistoryItem {
  id: string
  query: string
  answer: AssistantResponse
  timestamp: string
}

// === STREAM PROGRESS ===
export interface StreamProgress {
  headline: boolean
  directAnswer: boolean
  citations: boolean
  clientContext: boolean
}

// === CONTROLLER STATE ===
export interface AssistantControllerState {
  status: ControllerStatus
  activeRequestId: string | null
  activeQuery: string | null
  activeAnswer: AssistantResponse | null
  history: HistoryItem[]
  error: AssistantError | null
  retryCount: number
  streamProgress: StreamProgress
}
