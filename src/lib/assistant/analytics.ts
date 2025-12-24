import type { Surface, Topic, RefusalReason, ErrorType } from "./types"

export const ANALYTICS_EVENTS = [
  // Query lifecycle
  "assistant.query.submit",
  "assistant.query.complete",
  "assistant.query.partial",
  "assistant.query.refusal",
  "assistant.query.error",
  "assistant.query.cancelled",

  // User interactions
  "assistant.drawer.expand",
  "assistant.feedback.submit",
  "assistant.history.restore",
  "assistant.suggestion.click",
  "assistant.retry.attempt",

  // Marketing CTAs
  "marketing.cta.eligible",
  "marketing.cta.shown",
  "marketing.cta.click",
  "marketing.cta.dismiss",
  "marketing.trust_link.click",
  "marketing.coverage_request",
  "marketing.signup.start",
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

// Event payloads
export interface QuerySubmitPayload {
  surface: Surface
  queryLength: number
  suggestionUsed: boolean
  fromHistory: boolean
}

export interface QueryCompletePayload {
  surface: Surface
  topic: Topic
  kind: "ANSWER" | "REFUSAL" | "ERROR"
  latencyMs: number
  citationCount: number
}

export interface QueryRefusalPayload {
  surface: Surface
  topic: Topic
  refusalReason: RefusalReason
}

export interface QueryErrorPayload {
  errorType: ErrorType
  httpStatus?: number
  latencyMs: number
  surface: Surface
  retryCount: number
}

export interface DrawerExpandPayload {
  drawer: "why" | "sources" | "clientData"
}

export interface FeedbackSubmitPayload {
  requestId: string
  positive: boolean
  comment?: string
}

export interface SuggestionClickPayload {
  type: "initial" | "related" | "refusal"
  suggestionText: string
  position: number
}

export interface CTAShownPayload {
  location: "contextual" | "personalization" | "footer"
  variant: string
  topic: Topic
}

export interface CTAClickPayload extends CTAShownPayload {
  queriesInSession: number
}

// Union type for all payloads
export type AnalyticsPayload =
  | QuerySubmitPayload
  | QueryCompletePayload
  | QueryRefusalPayload
  | QueryErrorPayload
  | DrawerExpandPayload
  | FeedbackSubmitPayload
  | SuggestionClickPayload
  | CTAShownPayload
  | CTAClickPayload

export type AnalyticsEvent = {
  name: AnalyticsEventName
  payload: AnalyticsPayload
  timestamp: string
}
