// src/lib/assistant/reasoning/compat.ts
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "./pipeline"
import {
  isTerminal,
  type TerminalPayload,
  type AnswerPayload,
  type ConditionalAnswerPayload,
  type ErrorPayload,
} from "./types"
import type { RefusalPayload } from "./refusal-policy"
import {
  SCHEMA_VERSION as LEGACY_SCHEMA_VERSION,
  type AssistantResponse,
  type SourceCard,
  type CitationBlock,
  type Surface,
  type RefusalReason as LegacyRefusalReason,
} from "@/lib/assistant/types"

// Type aliases for backward compatibility
type FinalAnswerPayload = AnswerPayload & {
  outcome?: "ANSWER"
  asOfDate?: string
  citations?: Array<{
    id: string
    title: string
    authority: string
    quote: string
    url: string
    evidenceId: string
    fetchedAt: string
  }>
}

type QualifiedAnswerPayload = ConditionalAnswerPayload & {
  outcome?: "QUALIFIED_ANSWER"
  answerHr: string
  asOfDate?: string
  conflictWarnings: Array<{ description: string }>
  citations?: FinalAnswerPayload["citations"]
}

// Extended RefusalPayload for compat layer
type ExtendedRefusalPayload = RefusalPayload & {
  outcome?: "REFUSAL"
  message?: string
  reason?: string
  relatedTopics?: string[]
}

/**
 * Backward-compatible wrapper that runs the new reasoning pipeline
 * but returns the legacy AssistantResponse format.
 *
 * This allows gradual migration - existing consumers can continue
 * using the old format while new consumers use SSE streaming.
 */
export async function buildAnswerCompat(
  query: string,
  surface: Surface,
  _companyId?: string
): Promise<AssistantResponse> {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`

  const generator = buildAnswerWithReasoning(requestId, query, surface)

  let terminalPayload: TerminalPayload | undefined

  // Use while loop to capture the generator's return value
  // (for await...of discards the return value)
  while (true) {
    const result = await generator.next()
    if (result.done) {
      // This is the return value from the generator
      if (result.value) {
        terminalPayload = result.value
      }
      break
    }
    // Process yielded events - capture terminal event data
    const event = result.value
    if (isTerminal(event) && event.data) {
      terminalPayload = event.data as TerminalPayload
    }
  }

  if (!terminalPayload) {
    // Fallback error response
    return {
      schemaVersion: LEGACY_SCHEMA_VERSION,
      requestId,
      traceId,
      kind: "REFUSAL",
      topic: "REGULATORY",
      surface,
      createdAt: new Date().toISOString(),
      headline: "Doslo je do pogreske",
      directAnswer: "",
      refusalReason: "NO_CITABLE_RULES",
      refusal: {
        message: "Privremena pogreska sustava.",
      },
    }
  }

  return mapToLegacyResponse(terminalPayload, requestId, traceId, surface)
}

function mapToLegacyResponse(
  payload: TerminalPayload,
  requestId: string,
  traceId: string,
  surface: Surface
): AssistantResponse {
  const base = {
    schemaVersion: LEGACY_SCHEMA_VERSION,
    requestId,
    traceId,
    topic: "REGULATORY" as const,
    surface,
    createdAt: new Date().toISOString(),
  }

  // Determine outcome type from payload structure
  const outcome = (payload as { outcome?: string }).outcome

  if (outcome === "ANSWER" || "answerHr" in payload) {
    const answer = payload as FinalAnswerPayload
    return {
      ...base,
      kind: "ANSWER",
      headline: (answer.answerHr || "").substring(0, 120),
      directAnswer: answer.answerHr || "",
      asOfDate: answer.asOfDate,
      citations: mapCitations(answer.citations),
      confidence: { level: "HIGH", score: 0.9 },
    }
  }

  if (outcome === "CONDITIONAL_ANSWER" || "branches" in payload) {
    const qualified = payload as QualifiedAnswerPayload
    const answerHr = qualified.answerHr || ""
    const conflictWarnings = qualified.conflictWarnings || []
    return {
      ...base,
      kind: "ANSWER",
      headline: answerHr.substring(0, 120),
      directAnswer: answerHr,
      asOfDate: qualified.asOfDate,
      citations: mapCitations(qualified.citations),
      confidence: { level: "MEDIUM", score: 0.7 },
      conflict:
        conflictWarnings.length > 0
          ? {
              status: "CONTEXT_DEPENDENT",
              description: conflictWarnings[0].description,
              sources: [],
            }
          : undefined,
    }
  }

  if (outcome === "REFUSAL" || "template" in payload) {
    const refusal = payload as ExtendedRefusalPayload
    const message = refusal.message || refusal.template?.messageHr || "Nije moguće odgovoriti"
    const reason = refusal.reason || refusal.template?.code || "OUT_OF_SCOPE"
    return {
      ...base,
      kind: "REFUSAL",
      headline: message.substring(0, 120),
      directAnswer: "",
      refusalReason: mapRefusalReason(reason),
      refusal: {
        message,
        relatedTopics: refusal.relatedTopics,
      },
    }
  }

  if (outcome === "ERROR" || "correlationId" in payload) {
    const error = payload as ErrorPayload
    return {
      ...base,
      kind: "REFUSAL",
      headline: "Doslo je do pogreske",
      directAnswer: "",
      refusalReason: "NO_CITABLE_RULES",
      refusal: {
        message: error.message,
      },
      error: {
        message: error.message,
        retryable: error.retryable,
      },
    }
  }

  // Fallback for unknown payload types
  return {
    ...base,
    kind: "REFUSAL",
    headline: "Nepoznata pogreška",
    directAnswer: "",
    refusalReason: "NO_CITABLE_RULES",
    refusal: {
      message: "Nepoznati tip odgovora",
    },
  }
}

function mapCitations(citations: FinalAnswerPayload["citations"]): CitationBlock | undefined {
  if (!citations || citations.length === 0) return undefined

  const primary = citations[0]
  if (!primary.id || !primary.title || !primary.quote || !primary.url) {
    return undefined
  }

  const primaryCard: SourceCard = {
    id: primary.id,
    title: primary.title,
    authority: primary.authority as "LAW" | "REGULATION" | "GUIDANCE" | "PRACTICE",
    quote: primary.quote,
    url: primary.url,
    effectiveFrom: primary.fetchedAt?.split("T")[0] || new Date().toISOString().split("T")[0],
    confidence: 0.9,
    evidenceId: primary.evidenceId || "",
    fetchedAt: primary.fetchedAt || new Date().toISOString(),
  }

  const supporting: SourceCard[] = citations
    .slice(1)
    .filter((c) => c.id && c.title && c.quote && c.url)
    .map((c) => ({
      id: c.id!,
      title: c.title!,
      authority: c.authority as "LAW" | "REGULATION" | "GUIDANCE" | "PRACTICE",
      quote: c.quote!,
      url: c.url!,
      effectiveFrom: c.fetchedAt?.split("T")[0] || new Date().toISOString().split("T")[0],
      confidence: 0.8,
      evidenceId: c.evidenceId || "",
      fetchedAt: c.fetchedAt || new Date().toISOString(),
    }))

  return { primary: primaryCard, supporting }
}

/**
 * Maps reasoning RefusalPayload to legacy RefusalReason.
 * UNSUPPORTED_DOMAIN is mapped to OUT_OF_SCOPE as a fallback.
 */
function mapRefusalReason(reason: string | undefined): LegacyRefusalReason {
  if (!reason) return "OUT_OF_SCOPE"
  // Map from various reason codes to valid LegacyRefusalReason
  const reasonMapping: Record<string, LegacyRefusalReason> = {
    UNSUPPORTED_DOMAIN: "OUT_OF_SCOPE",
    CANNOT_VERIFY: "NO_CITABLE_RULES",
    TOO_COMPLEX: "OUT_OF_SCOPE",
    CONFLICTING_RULES: "UNRESOLVED_CONFLICT",
    AMBIGUOUS_QUERY: "NEEDS_CLARIFICATION",
  }
  if (reason in reasonMapping) {
    return reasonMapping[reason]
  }
  // Check if it's a valid LegacyRefusalReason
  const validReasons: LegacyRefusalReason[] = [
    "OUT_OF_SCOPE",
    "NO_CITABLE_RULES",
    "MISSING_CLIENT_DATA",
    "UNRESOLVED_CONFLICT",
    "NEEDS_CLARIFICATION",
    "UNSUPPORTED_JURISDICTION",
  ]
  if (validReasons.includes(reason as LegacyRefusalReason)) {
    return reason as LegacyRefusalReason
  }
  return "OUT_OF_SCOPE"
}
