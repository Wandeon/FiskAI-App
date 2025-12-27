// src/lib/assistant/reasoning/types.ts

/**
 * Schema version for reasoning events
 */
export const REASONING_EVENT_VERSION = 1

/**
 * All possible reasoning stages
 */
export type ReasoningStage =
  | "QUESTION_INTAKE"
  | "CONTEXT_RESOLUTION"
  | "CLARIFICATION"
  | "SOURCES"
  | "RETRIEVAL"
  | "APPLICABILITY"
  | "CONFLICTS"
  | "ANALYSIS"
  | "CONFIDENCE"
  | "ANSWER"
  | "CONDITIONAL_ANSWER"
  | "REFUSAL"
  | "ERROR"

/**
 * Array of all reasoning stages in order
 */
export const REASONING_STAGES: ReasoningStage[] = [
  "QUESTION_INTAKE",
  "CONTEXT_RESOLUTION",
  "CLARIFICATION",
  "SOURCES",
  "RETRIEVAL",
  "APPLICABILITY",
  "CONFLICTS",
  "ANALYSIS",
  "CONFIDENCE",
  "ANSWER",
  "CONDITIONAL_ANSWER",
  "REFUSAL",
  "ERROR",
]

/**
 * Risk tier classification
 */
export type RiskTier = "T0" | "T1" | "T2" | "T3"

/**
 * Event status
 */
export type EventStatus = "started" | "progress" | "checkpoint" | "complete" | "awaiting_input"

/**
 * Severity level for events
 */
export type EventSeverity = "info" | "warning" | "critical"

/**
 * Progress tracking
 */
export interface EventProgress {
  current: number
  total?: number
}

/**
 * Stage-specific payload types
 */
export interface QuestionIntakePayload {
  normalizedQuery: string
  detectedLanguage: string
  entities: {
    subjects: string[]
    products: string[]
    locations: string[]
    dates: string[]
  }
}

export interface ContextResolutionPayload {
  domain?: string
  jurisdiction: string
  riskTier: string
  summary?: string
  language?: string
  intent?: string
  asOfDate?: string
  entities?: Array<{ type: string; value: string; confidence: number }>
  userContext?: Record<string, unknown>
  userContextSnapshot?: UserContextSnapshot
  confidence: number
  requiresClarification?: boolean
  suggestedClarifications?: string[]
}

export interface ClarificationPayload {
  question: string
  questionHr?: string
  options?: string[] | Array<{ label: string; value: string }>
  dimensionNeeded?: string
  freeformAllowed?: boolean
}

export interface SourcePayload {
  sourceId: string
  sourceName: string
  sourceType: string
  url?: string
}

export interface RetrievalPayload {
  intent: string
  conceptsMatched: string[]
  rulesRetrieved: number
}

export interface ApplicabilityPayload {
  eligibleRules: number
  excludedRules: number
  exclusionReasons: string[]
  coverageResult: {
    requiredScore: number
    totalScore: number
    terminalOutcome: string
  }
}

export interface AnalysisPayload {
  checkpoint?: string
  conflictsDetected: number
  riskAssessment?: string
}

export interface ConfidencePayload {
  overallConfidence: number
  sourceConfidence: number
  ruleConfidence: number
  coverageConfidence: number
}

export interface AnswerPayload {
  answer?: string
  answerHr: string
  asOfDate?: string
  citations?: Array<{
    // Either rule-based format
    ruleId?: string
    ruleName?: string
    sourceUrl?: string
    // Or evidence-based format
    id?: string
    title?: string
    authority?: string
    quote?: string
    url?: string
    evidenceId?: string
    fetchedAt?: string
  }>
  value?: string
  valueType?: string
  structured?: {
    obligations?: string[]
    deadlines?: string[]
    thresholds?: string[]
  }
}

export interface ConditionalAnswerPayload {
  branches: Array<{
    condition: string
    conditionHr: string
    answer: string
    answerHr: string
    probability?: number
  }>
  commonParts?: string
}

export interface RefusalPayload {
  code?: string
  reason?: string // Alias for code
  messageHr?: string
  messageEn?: string
  message?: string // Shorthand for messageHr
  nextSteps?: Array<{
    type: string
    prompt?: string
    promptHr?: string
  }>
  relatedTopics?: string[]
  context?: {
    missingDimensions?: string[]
    conflictingRules?: string[]
  }
  // Template structure (from compat layer)
  template?: {
    code: string
    messageHr: string
    nextSteps?: Array<{
      type: string
      prompt?: string
      promptHr?: string
    }>
  }
}

export interface ErrorPayload {
  correlationId: string
  code?: string // Error code
  message: string
  retryable: boolean
}

/**
 * Conflicts stage payload
 */
export interface ConflictsStagePayload {
  summary?: string
  conflictCount?: number
  resolved?: number
  unresolved?: number
  canProceedWithWarning?: boolean
}

/**
 * Generic stage payload for stages that just need summary/progress info
 */
export interface GenericStagePayload {
  summary?: string
  [key: string]: unknown
}

/**
 * Union of all payload types
 */
export type StagePayload =
  | QuestionIntakePayload
  | ContextResolutionPayload
  | ClarificationPayload
  | SourcePayload
  | RetrievalPayload
  | ApplicabilityPayload
  | ConflictsStagePayload
  | AnalysisPayload
  | ConfidencePayload
  | AnswerPayload
  | ConditionalAnswerPayload
  | RefusalPayload
  | ErrorPayload
  | GenericStagePayload

/**
 * Core reasoning event structure
 */
export interface ReasoningEvent {
  v: typeof REASONING_EVENT_VERSION
  id: string
  requestId: string
  seq: number
  ts: string
  stage: ReasoningStage
  status: EventStatus
  message?: string
  severity?: EventSeverity
  progress?: EventProgress
  data?: StagePayload
}

/**
 * Terminal payloads (final outcomes)
 */
export type TerminalPayload =
  | (AnswerPayload & { outcome?: "ANSWER" })
  | (ConditionalAnswerPayload & { outcome?: "CONDITIONAL_ANSWER" })
  | (RefusalPayload & { outcome?: "REFUSAL" })
  | (ErrorPayload & { outcome?: "ERROR" })

/**
 * User context for pipeline
 */
export interface UserContext {
  userId?: string
  companyId?: string
  isVatPayer?: boolean
  legalForm?: string
  jurisdiction?: string
}

/**
 * User context snapshot for audit logging
 */
export interface UserContextSnapshot {
  vatStatus?: "registered" | "unregistered" | "unknown"
  turnoverBand?: string
  companySize?: "micro" | "small" | "medium" | "large"
  jurisdiction?: string
  assumedDefaults: string[]
  resolvedContext?: UserContext
}

/**
 * Terminal outcome type
 */
export type TerminalOutcome = "ANSWER" | "CONDITIONAL_ANSWER" | "REFUSAL" | "ERROR"

/**
 * Check if an event is terminal
 */
export function isTerminal(event: ReasoningEvent): boolean {
  return ["ANSWER", "CONDITIONAL_ANSWER", "REFUSAL", "ERROR"].includes(event.stage)
}

/**
 * Get terminal outcome from event
 */
export function getTerminalOutcome(event: ReasoningEvent): TerminalOutcome | null {
  if (isTerminal(event)) {
    return event.stage as TerminalOutcome
  }
  return null
}

/**
 * Conflicts payload for analysis stage
 */
export interface ConflictsPayload {
  conflictId: string
  ruleIds: string[]
  resolution?: string
}

/**
 * Helper to create event ID
 */
export function createEventId(requestId: string, seq: number): string {
  return `${requestId}_${String(seq).padStart(3, "0")}`
}

/**
 * Source summary for source discovery stage
 */
export interface SourceSummary {
  id: string
  name: string
  authority: string
  url?: string
}

/**
 * Sources stage payload
 */
export interface SourcesPayload {
  summary: string
  sources: SourceSummary[]
}
