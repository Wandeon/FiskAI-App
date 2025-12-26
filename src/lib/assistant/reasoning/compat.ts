// src/lib/assistant/reasoning/compat.ts
import { nanoid } from "nanoid"
import { buildAnswerWithReasoning } from "./pipeline"
import {
  isTerminal,
  type TerminalPayload,
  type FinalAnswerPayload,
  type QualifiedAnswerPayload,
  type RefusalPayload,
  type ErrorPayload,
} from "./types"
import {
  SCHEMA_VERSION as LEGACY_SCHEMA_VERSION,
  type AssistantResponse,
  type SourceCard,
  type CitationBlock,
  type Surface,
  type RefusalReason as LegacyRefusalReason,
} from "@/lib/assistant/types"

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

  switch (payload.outcome) {
    case "ANSWER": {
      const answer = payload as FinalAnswerPayload & { outcome: "ANSWER" }
      return {
        ...base,
        kind: "ANSWER",
        headline: answer.answerHr.substring(0, 120),
        directAnswer: answer.answerHr,
        asOfDate: answer.asOfDate,
        citations: mapCitations(answer.citations),
        confidence: { level: "HIGH", score: 0.9 },
      }
    }

    case "QUALIFIED_ANSWER": {
      const qualified = payload as QualifiedAnswerPayload & { outcome: "QUALIFIED_ANSWER" }
      return {
        ...base,
        kind: "ANSWER",
        headline: qualified.answerHr.substring(0, 120),
        directAnswer: qualified.answerHr,
        asOfDate: qualified.asOfDate,
        citations: mapCitations(qualified.citations),
        confidence: { level: "MEDIUM", score: 0.7 },
        conflict:
          qualified.conflictWarnings.length > 0
            ? {
                status: "CONTEXT_DEPENDENT",
                description: qualified.conflictWarnings[0].description,
                sources: [],
              }
            : undefined,
      }
    }

    case "REFUSAL": {
      const refusal = payload as RefusalPayload & { outcome: "REFUSAL" }
      return {
        ...base,
        kind: "REFUSAL",
        headline: refusal.message.substring(0, 120),
        directAnswer: "",
        refusalReason: mapRefusalReason(refusal.reason),
        refusal: {
          message: refusal.message,
          relatedTopics: refusal.relatedTopics,
        },
      }
    }

    case "ERROR": {
      const error = payload as ErrorPayload & { outcome: "ERROR" }
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
          retryable: error.retriable,
        },
      }
    }
  }
}

function mapCitations(citations: FinalAnswerPayload["citations"]): CitationBlock | undefined {
  if (!citations || citations.length === 0) return undefined

  const primary = citations[0]
  const primaryCard: SourceCard = {
    id: primary.id,
    title: primary.title,
    authority: primary.authority,
    quote: primary.quote,
    url: primary.url,
    effectiveFrom: primary.fetchedAt.split("T")[0],
    confidence: 0.9,
    evidenceId: primary.evidenceId,
    fetchedAt: primary.fetchedAt,
  }

  const supporting: SourceCard[] = citations.slice(1).map((c) => ({
    id: c.id,
    title: c.title,
    authority: c.authority,
    quote: c.quote,
    url: c.url,
    effectiveFrom: c.fetchedAt.split("T")[0],
    confidence: 0.8,
    evidenceId: c.evidenceId,
    fetchedAt: c.fetchedAt,
  }))

  return { primary: primaryCard, supporting }
}

/**
 * Maps reasoning RefusalPayload.reason to legacy RefusalReason.
 * UNSUPPORTED_DOMAIN is mapped to OUT_OF_SCOPE as a fallback.
 */
function mapRefusalReason(reason: RefusalPayload["reason"]): LegacyRefusalReason {
  if (reason === "UNSUPPORTED_DOMAIN") {
    return "OUT_OF_SCOPE"
  }
  return reason
}
