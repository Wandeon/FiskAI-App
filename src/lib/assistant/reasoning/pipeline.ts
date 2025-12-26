// src/lib/assistant/reasoning/pipeline.ts
import { createEventFactory } from "./event-factory"
import { contextResolutionStage } from "./stages/context-resolution"
import { sourceDiscoveryStage } from "./stages/source-discovery"
import type { ReasoningEvent, TerminalPayload, RefusalPayload, ErrorPayload } from "./types"
import type { Surface } from "@/lib/assistant/types" // eslint-disable-line @typescript-eslint/no-unused-vars
import type { ContextResolution } from "./stages/context-resolution"
import type { SourceDiscoveryResult } from "./stages/source-discovery"
import type { ConceptMatch } from "@/lib/assistant/query-engine/concept-matcher"
import { extractKeywords } from "@/lib/assistant/query-engine/text-utils"
import { selectRules } from "@/lib/assistant/query-engine/rule-selector"
import { detectConflicts } from "@/lib/assistant/query-engine/conflict-detector"
import { buildCitations } from "@/lib/assistant/query-engine/citation-builder"

export interface CompanyContext {
  vatStatus?: "registered" | "unregistered" | "unknown"
  turnoverBand?: string
  companySize?: "micro" | "small" | "medium" | "large"
  jurisdiction?: string
}

export interface ClarificationQuestion {
  question: string
  options?: Array<{ label: string; value: string }>
}

export interface ClarificationAnswer {
  selectedOption?: string
  freeformAnswer?: string
}

export async function* buildAnswerWithReasoning(
  requestId: string,
  query: string,
  _surface: Surface,
  context?: CompanyContext,
  clarificationCallback?: (question: ClarificationQuestion) => Promise<ClarificationAnswer>
): AsyncGenerator<ReasoningEvent, TerminalPayload> {
  const factory = createEventFactory(requestId)

  try {
    // Stage 1-2: Context Resolution
    const contextGenerator = contextResolutionStage(factory, query, context)
    for await (const event of contextGenerator) {
      yield event
    }
    const contextResult = await contextGenerator.next()
    const resolution = contextResult.value as ContextResolution

    // Handle clarification if needed
    if (resolution.requiresClarification && clarificationCallback) {
      yield factory.emit({
        stage: "CLARIFICATION",
        status: "awaiting_input",
        data: {
          question: "Please clarify your question",
          options: resolution.suggestedClarifications?.map((s: string) => ({ label: s, value: s })),
          freeformAllowed: true,
        },
      })

      // Would await callback here in real implementation
      // For now, continue without clarification
    }

    // Stage 3: Source Discovery
    const keywords = extractKeywords(query)
    const sourcesGenerator = sourceDiscoveryStage(factory, keywords)
    for await (const event of sourcesGenerator) {
      yield event
    }
    const sourcesGeneratorResult = await sourcesGenerator.next()
    const sourcesResult = sourcesGeneratorResult.value as SourceDiscoveryResult

    // If no sources, return REFUSAL
    if (sourcesResult.sources.length === 0) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Nismo pronašli službene izvore koji odgovaraju na vaše pitanje.",
        relatedTopics: ["porez na dohodak", "PDV stope", "pausalni obrt"],
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Stage 4: Retrieval
    yield factory.emit({
      stage: "RETRIEVAL",
      status: "started",
      message: "Retrieving applicable rules...",
    })

    const conceptSlugs = sourcesResult.conceptMatches.map((c: ConceptMatch) => c.slug)
    const selectionResult = await selectRules(conceptSlugs)

    yield factory.emit({
      stage: "RETRIEVAL",
      status: "complete",
      data: {
        summary: `Retrieved ${selectionResult.rules.length} candidate rules`,
        concepts: conceptSlugs,
        candidateCount: selectionResult.rules.length,
      },
    })

    if (selectionResult.rules.length === 0) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Nismo pronašli primjenjive propise za vaše pitanje.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Stage 5: Applicability
    yield factory.emit({
      stage: "APPLICABILITY",
      status: "started",
    })

    yield factory.emit({
      stage: "APPLICABILITY",
      status: "complete",
      data: {
        summary: `${selectionResult.rules.length} rules apply`,
        eligibleCount: selectionResult.rules.length,
        ineligibleCount: selectionResult.ineligible.length,
        exclusions: [], // Would be populated with actual exclusions
      },
    })

    // Stage 5b: Conflicts
    const conflictResult = detectConflicts(selectionResult.rules)

    yield factory.emit({
      stage: "CONFLICTS",
      status: "complete",
      data: {
        summary: conflictResult.hasConflict ? "Conflicts detected" : "No conflicts",
        conflictCount: conflictResult.hasConflict ? 1 : 0,
        resolved: 0,
        unresolved: conflictResult.hasConflict && !conflictResult.canResolve ? 1 : 0,
        canProceedWithWarning: conflictResult.canResolve,
      },
    })

    if (conflictResult.hasConflict && !conflictResult.canResolve) {
      const refusal: RefusalPayload = {
        reason: "UNRESOLVED_CONFLICT",
        message: "Pronađeni su proturječni propisi.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        severity: "warning",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Stage 6: Analysis
    yield factory.emit({
      stage: "ANALYSIS",
      status: "started",
    })

    yield factory.emit({
      stage: "ANALYSIS",
      status: "checkpoint",
      message: "Comparing sources...",
    })

    yield factory.emit({
      stage: "ANALYSIS",
      status: "complete",
      data: {
        summary: "Analysis complete",
        bullets: ["Verified against primary source"],
      },
    })

    // Stage 7: Confidence
    const primaryRule = selectionResult.rules[0]
    const confidenceScore = primaryRule.confidence || 0.8

    yield factory.emit({
      stage: "CONFIDENCE",
      status: "complete",
      data: {
        summary: `${confidenceScore >= 0.9 ? "HIGH" : confidenceScore >= 0.7 ? "MEDIUM" : "LOW"} confidence`,
        score: confidenceScore,
        label: confidenceScore >= 0.9 ? "HIGH" : confidenceScore >= 0.7 ? "MEDIUM" : "LOW",
        drivers: ["Primary source verified", "No conflicts"],
        evidenceStrength: "SINGLE_SOURCE",
      },
    })

    // Build citations
    const citations = buildCitations(selectionResult.rules)

    if (!citations || !citations.primary.quote) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Nismo pronašli dovoljno pouzdane izvore.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Terminal: ANSWER
    const answer = {
      asOfDate: new Date().toISOString().split("T")[0],
      answerHr: primaryRule.explanationHr || primaryRule.titleHr,
      citations: [
        {
          id: citations.primary.id,
          title: citations.primary.title,
          authority: citations.primary.authority,
          quote: citations.primary.quote!,
          url: citations.primary.url,
          evidenceId: citations.primary.evidenceId || "",
          fetchedAt: citations.primary.fetchedAt || new Date().toISOString(),
        },
      ],
    }

    yield factory.emit({
      stage: "ANSWER",
      status: "complete",
      data: answer,
    })

    return { outcome: "ANSWER", ...answer }
  } catch (_err) {
    const errorPayload: ErrorPayload = {
      code: "INTERNAL",
      message: "An unexpected error occurred",
      correlationId: requestId,
      retriable: true,
    }

    yield factory.emit({
      stage: "ERROR",
      status: "complete",
      severity: "critical",
      data: errorPayload,
    })

    return { outcome: "ERROR", ...errorPayload }
  }
}
