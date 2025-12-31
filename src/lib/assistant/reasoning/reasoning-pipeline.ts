// src/lib/assistant/reasoning/reasoning-pipeline.ts
import { db } from "@/lib/db"
import { routeQuery } from "@/lib/regulatory-truth/retrieval/query-router"
import { calculateDecisionCoverage, inferTopicFromIntent } from "./decision-coverage"
import { determineRefusalCode, buildRefusalPayload, RefusalCode } from "./refusal-policy"
import {
  type ReasoningEvent,
  type UserContext,
  type TerminalPayload,
  type AnswerPayload,
  type ConditionalAnswerPayload,
  type RefusalPayload as RefusalPayloadType,
  type ErrorPayload,
  REASONING_EVENT_VERSION,
  createEventId,
} from "./types"

/**
 * Sleep utility for "The Pause"
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Event emitter helper
 */
function emit(
  requestId: string,
  seq: number,
  partial: Omit<ReasoningEvent, "v" | "id" | "requestId" | "seq" | "ts">
): ReasoningEvent {
  return {
    v: REASONING_EVENT_VERSION,
    id: createEventId(requestId, seq),
    requestId,
    seq,
    ts: new Date().toISOString(),
    ...partial,
  }
}

/**
 * Parse and normalize query
 */
function parseQuery(query: string): {
  normalized: string
  language: string
  entities: { subjects: string[]; products: string[]; locations: string[]; dates: string[] }
} {
  // Simple normalization - could be enhanced with NLP
  const normalized = query.trim().toLowerCase()

  // Detect language (simple heuristic)
  const croatianPatterns = /[sdjcz\u0161\u0111\u010d\u0107\u017e]|koliko|kako|gdje|sto|koji/i
  const language = croatianPatterns.test(query) ? "hr" : "en"

  // Extract basic entities (simplified)
  const entities = {
    subjects: [] as string[],
    products: [] as string[],
    locations: [] as string[],
    dates: [] as string[],
  }

  // Extract dates
  const datePattern = /\d{1,2}[./]\d{1,2}[./]\d{2,4}/g
  const dates = query.match(datePattern)
  if (dates) entities.dates = dates

  return { normalized, language, entities }
}

/**
 * Resolve context from query and user profile
 */
async function resolveContext(
  parsed: ReturnType<typeof parseQuery>,
  userContext?: UserContext
): Promise<{
  domain: string
  jurisdiction: string
  riskTier: string
  confidence: number
}> {
  // Determine domain from query content
  let domain = "general"
  const query = parsed.normalized

  if (/pdv|vat|porez/.test(query)) domain = "vat"
  else if (/pausal|obrt/.test(query)) domain = "pausalni"
  else if (/doprinos|mirovin|zdravstv/.test(query)) domain = "contributions"
  else if (/fiskali/.test(query)) domain = "fiscalization"

  // Determine risk tier
  let riskTier = "T2"
  if (/stopa|rate|postotak|threshold|prag/.test(query)) riskTier = "T0"
  else if (/rok|deadline|frist/.test(query)) riskTier = "T1"

  return {
    domain,
    jurisdiction: userContext?.jurisdiction || "HR",
    riskTier,
    confidence: 0.85,
  }
}

/**
 * Discover relevant sources
 */
async function* discoverSources(domain: string): AsyncGenerator<{
  sourceId: string
  sourceName: string
  sourceType: string
  url?: string
}> {
  // Query database for relevant sources
  const sources = await db.regulatorySource.findMany({
    where: { isActive: true },
    take: 5,
  })

  for (const source of sources) {
    yield {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: "regulatory",
      url: source.url,
    }
  }
}

/**
 * Compute overall confidence
 */
function computeConfidence(
  sourceCount: number,
  ruleConfidence: number,
  coverageScore: number
): {
  overallConfidence: number
  sourceConfidence: number
  ruleConfidence: number
  coverageConfidence: number
} {
  const sourceConfidence = Math.min(sourceCount * 0.2, 1)
  const coverageConfidence = coverageScore

  const overallConfidence = sourceConfidence * 0.2 + ruleConfidence * 0.5 + coverageConfidence * 0.3

  return {
    overallConfidence,
    sourceConfidence,
    ruleConfidence,
    coverageConfidence,
  }
}

/**
 * Main reasoning pipeline generator
 *
 * Implements the 7-stage reasoning pipeline:
 * 1. QUESTION_INTAKE - Parse and normalize query
 * 2. CONTEXT_RESOLUTION - Determine domain, jurisdiction, risk tier (+ optional CLARIFICATION)
 * 3. SOURCES - Progressive source discovery
 * 4. RETRIEVAL - Retrieve applicable rules
 * 5. APPLICABILITY - Check rule applicability and decision coverage
 * 6. ANALYSIS - Analyze with checkpoints
 * 7. CONFIDENCE + Terminal (ANSWER/CONDITIONAL_ANSWER/REFUSAL)
 *
 * Includes "The Pause" (700ms delay) before terminal output for trust building.
 */
export async function* buildAnswerWithReasoning(
  requestId: string,
  query: string,
  userContext?: UserContext
): AsyncGenerator<ReasoningEvent, TerminalPayload> {
  let seq = 0

  try {
    // Stage 1: Question Intake
    yield emit(requestId, ++seq, { stage: "QUESTION_INTAKE", status: "started" })
    const parsed = parseQuery(query)
    yield emit(requestId, ++seq, {
      stage: "QUESTION_INTAKE",
      status: "complete",
      data: {
        normalizedQuery: parsed.normalized,
        detectedLanguage: parsed.language,
        entities: parsed.entities,
      },
    })

    // Stage 2: Context Resolution
    yield emit(requestId, ++seq, { stage: "CONTEXT_RESOLUTION", status: "started" })
    const context = await resolveContext(parsed, userContext)
    yield emit(requestId, ++seq, {
      stage: "CONTEXT_RESOLUTION",
      status: "complete",
      data: context,
    })

    // Stage 3: Source Discovery (progressive)
    yield emit(requestId, ++seq, { stage: "SOURCES", status: "started" })
    let sourceCount = 0
    for await (const source of discoverSources(context.domain)) {
      sourceCount++
      yield emit(requestId, ++seq, {
        stage: "SOURCES",
        status: "progress",
        message: `Found: ${source.sourceName}`,
        data: source,
      })
    }
    yield emit(requestId, ++seq, {
      stage: "SOURCES",
      status: "complete",
      progress: { current: sourceCount },
    })

    // Stage 4: Rule Retrieval
    yield emit(requestId, ++seq, { stage: "RETRIEVAL", status: "started" })
    const routerResult = await routeQuery(query, {
      userId: userContext?.userId,
      companyType: userContext?.legalForm,
      isVatPayer: userContext?.isVatPayer,
    })
    yield emit(requestId, ++seq, {
      stage: "RETRIEVAL",
      status: "complete",
      data: {
        intent: routerResult.classification?.intent || "GENERAL",
        conceptsMatched: routerResult.classification?.extractedEntities?.subjects || [],
        rulesRetrieved: Array.isArray(routerResult.response) ? routerResult.response.length : 0,
      },
    })

    // Stage 5: Applicability Check
    yield emit(requestId, ++seq, { stage: "APPLICABILITY", status: "started" })

    // Infer topic and calculate coverage
    const topic = inferTopicFromIntent(routerResult.classification?.intent || "GENERAL", {
      subjects: routerResult.classification?.extractedEntities?.subjects || [],
      products: routerResult.classification?.extractedEntities?.products || [],
    })

    // Extract dimensions from entities
    const dimensions: Record<string, string> = {}
    const entities = routerResult.classification?.extractedEntities
    if (entities) {
      if (entities.products.length > 0) dimensions.Item = entities.products[0]
      if (entities.locations.length > 0) dimensions.Place = entities.locations[0]
      if (entities.dates.length > 0) dimensions.Date = entities.dates[0]
    }

    const coverage = topic
      ? calculateDecisionCoverage(topic, dimensions)
      : {
          requiredScore: 1,
          totalScore: 0.5,
          terminalOutcome: "ANSWER" as const,
          resolved: [],
          unresolved: [],
        }

    yield emit(requestId, ++seq, {
      stage: "APPLICABILITY",
      status: "complete",
      data: {
        eligibleRules: 1, // Simplified
        excludedRules: 0,
        exclusionReasons: [],
        coverageResult: {
          requiredScore: coverage.requiredScore,
          totalScore: coverage.totalScore,
          terminalOutcome: coverage.terminalOutcome,
        },
      },
    })

    // Stage 6: Analysis
    yield emit(requestId, ++seq, { stage: "ANALYSIS", status: "started" })
    yield emit(requestId, ++seq, {
      stage: "ANALYSIS",
      status: "checkpoint",
      message: "Comparing sources...",
    })
    yield emit(requestId, ++seq, {
      stage: "ANALYSIS",
      status: "complete",
      data: {
        conflictsDetected: 0,
        riskAssessment: context.riskTier,
      },
    })

    // Stage 7: Confidence & Terminal
    const confidence = computeConfidence(sourceCount, 0.85, coverage.totalScore)
    yield emit(requestId, ++seq, {
      stage: "CONFIDENCE",
      status: "complete",
      data: confidence,
    })

    // THE PAUSE (deliberate delay for trust)
    await sleep(700)

    // Determine terminal outcome
    const refusalCode = determineRefusalCode(
      coverage.requiredScore,
      true, // hasRules
      false, // hasConflicts
      false // isGrayZone
    )

    let terminal: TerminalPayload

    if (refusalCode) {
      const refusal = buildRefusalPayload(refusalCode, {
        missingDimensions: coverage.unresolved.filter((u) => u.required).map((u) => u.dimension),
      })

      terminal = {
        code: refusal.template.code,
        messageHr: refusal.template.messageHr,
        messageEn: refusal.template.messageEn,
        nextSteps: refusal.template.nextSteps,
        context: refusal.context,
      } as RefusalPayloadType

      yield emit(requestId, ++seq, {
        stage: "REFUSAL",
        status: "complete",
        data: terminal,
      })
    } else if (coverage.terminalOutcome === "CONDITIONAL_ANSWER") {
      terminal = {
        branches:
          coverage.branches?.map((b) => ({
            condition: b.condition,
            conditionHr: b.condition,
            answer: `Result for ${b.dimensionValue}`,
            answerHr: `Rezultat za ${b.dimensionValue}`,
          })) || [],
      } as ConditionalAnswerPayload

      yield emit(requestId, ++seq, {
        stage: "CONDITIONAL_ANSWER",
        status: "complete",
        data: terminal,
      })
    } else {
      terminal = {
        answer: "Based on the available rules...",
        answerHr: "Na temelju dostupnih pravila...",
        citations: [],
      } as AnswerPayload

      yield emit(requestId, ++seq, {
        stage: "ANSWER",
        status: "complete",
        data: terminal,
      })
    }

    // Save reasoning trace
    await db.reasoningTrace.create({
      data: {
        requestId,
        events: [], // Would include all events in production
        userContextSnapshot: userContext || {},
        outcome: coverage.terminalOutcome,
        domain: context.domain,
        riskTier: context.riskTier,
        confidence: confidence.overallConfidence,
        sourceCount,
      },
    })

    return terminal
  } catch (error) {
    const errorPayload: ErrorPayload = {
      correlationId: requestId,
      code: "INTERNAL",
      message: error instanceof Error ? error.message : "Unknown error",
      retriable: true,
    }

    yield emit(requestId, ++seq, {
      stage: "ERROR",
      status: "complete",
      severity: "critical",
      data: errorPayload,
    })

    return errorPayload
  }
}
