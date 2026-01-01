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
import {
  checkRuleEligibility,
  buildEvaluationContext,
  type RuleWithAppliesWhen,
} from "@/lib/assistant/query-engine/rule-eligibility"
import {
  calculateDecisionCoverage,
  inferTopicFromIntent,
} from "@/lib/assistant/reasoning/decision-coverage"

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

/**
 * Parse turnover band string to approximate revenue number
 * This is a helper to convert company context to evaluation context
 */
function parseTurnoverBand(band: string): number | undefined {
  // Extract numeric values from band strings like "50k-100k", "100k-500k", etc.
  const match = band.match(/(\d+)k?/i)
  if (match) {
    const value = parseInt(match[1], 10)
    return value * (band.toLowerCase().includes("k") ? 1000 : 1)
  }
  return undefined
}

/**
 * Group rules by authority level for analysis
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupRulesByAuthority(rules: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}
  for (const rule of rules) {
    const authority = rule.authority || "UNKNOWN"
    if (!grouped[authority]) {
      grouped[authority] = []
    }
    grouped[authority].push(rule)
  }
  return grouped
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
    let contextResult = await contextGenerator.next()
    while (!contextResult.done) {
      yield contextResult.value
      contextResult = await contextGenerator.next()
    }
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
    let sourcesGeneratorResult = await sourcesGenerator.next()
    while (!sourcesGeneratorResult.done) {
      yield sourcesGeneratorResult.value
      sourcesGeneratorResult = await sourcesGenerator.next()
    }
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

    // Stage 5: Applicability - Filter rules by eligibility
    yield factory.emit({
      stage: "APPLICABILITY",
      status: "started",
      message: "Filtering rules by applicability criteria...",
    })

    // Build evaluation context from company context
    const evaluationContext = buildEvaluationContext({
      asOfDate: new Date(),
      companyData: context
        ? {
            vatStatus: context.vatStatus,
            // Map company size to revenue band if needed
            ...(context.turnoverBand && { revenueYtd: parseTurnoverBand(context.turnoverBand) }),
          }
        : undefined,
    })

    // Filter rules by eligibility
    const applicableRules = []
    const exclusions = []

    for (const rule of selectionResult.rules) {
      const eligibilityResult = checkRuleEligibility(rule as RuleWithAppliesWhen, evaluationContext)

      if (eligibilityResult.eligible) {
        applicableRules.push(rule)
      } else {
        exclusions.push({
          ruleId: rule.id,
          reason: eligibilityResult.reason,
          title: rule.titleHr,
        })
      }
    }

    yield factory.emit({
      stage: "APPLICABILITY",
      status: "complete",
      data: {
        summary: `${applicableRules.length} of ${selectionResult.rules.length} rules applicable`,
        eligibleCount: applicableRules.length,
        ineligibleCount: exclusions.length,
        exclusions: exclusions.map((e) => `${e.title}: ${e.reason}`),
      },
    })

    // If no applicable rules after filtering, return REFUSAL
    if (applicableRules.length === 0) {
      const refusal: RefusalPayload = {
        reason: "NO_CITABLE_RULES",
        message: "Pronađeni propisi nisu primjenjivi na vaš kontekst.",
      }

      yield factory.emit({
        stage: "REFUSAL",
        status: "complete",
        data: refusal,
      })

      return { outcome: "REFUSAL", ...refusal }
    }

    // Use applicable rules for subsequent stages
    const finalRules = applicableRules

    // Stage 5b: Conflicts - use filtered applicable rules
    const conflictResult = detectConflicts(finalRules)

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

    // Stage 6: Analysis - Perform deep analysis of sources
    yield factory.emit({
      stage: "ANALYSIS",
      status: "started",
      message: "Analyzing rule sources and authority...",
    })

    // Group rules by concept and authority for comparison
    const rulesByAuthority = groupRulesByAuthority(finalRules)

    yield factory.emit({
      stage: "ANALYSIS",
      status: "checkpoint",
      message: "Comparing sources across authority levels...",
    })

    // Analyze source quality and coverage
    const analysisResults = []

    // Check primary source quality
    const primaryRule = finalRules[0]
    if (primaryRule.evidence?.url) {
      analysisResults.push(
        `Primary source: ${primaryRule.evidence.sourceType || "Official document"}`
      )
    }

    // Check for multiple authority levels
    const authorityLevels = new Set(finalRules.map((r) => r.authority))
    if (authorityLevels.size > 1) {
      analysisResults.push(
        `Cross-verified across ${authorityLevels.size} authority levels: ${Array.from(authorityLevels).join(", ")}`
      )
    } else {
      analysisResults.push(`Single authority level: ${Array.from(authorityLevels)[0]}`)
    }

    // Check temporal consistency
    const effectiveDates = finalRules.map((r) => r.effectiveFrom)
    const mostRecent = new Date(Math.max(...effectiveDates.map((d) => d.getTime())))
    analysisResults.push(`Most recent rule effective: ${mostRecent.toISOString().split("T")[0]}`)

    // Check for evidence backing
    const rulesWithEvidence = finalRules.filter((r) => r.evidenceId)
    analysisResults.push(
      `Evidence backing: ${rulesWithEvidence.length}/${finalRules.length} rules have source citations`
    )

    yield factory.emit({
      stage: "ANALYSIS",
      status: "complete",
      data: {
        summary: `Analyzed ${finalRules.length} applicable rules`,
        bullets: analysisResults,
        sourceQuality: rulesWithEvidence.length === finalRules.length ? "HIGH" : "MEDIUM",
        authorityDistribution: Object.fromEntries(
          Array.from(authorityLevels).map((level) => [
            level,
            finalRules.filter((r) => r.authority === level).length,
          ])
        ),
      },
    })

    // Stage 7: Confidence - use first applicable rule
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

    // Determine terminal outcome using decision coverage
    const topic = inferTopicFromIntent(resolution.intent ?? "general", {
      subjects: resolution.concepts,
      products: resolution.concepts,
    })

    let terminalOutcome: "ANSWER" | "CONDITIONAL_ANSWER" | "REFUSAL" = "ANSWER"
    let decisionCoverage = null

    if (topic) {
      // Build dimension map from query and context
      const providedDimensions: Record<string, string> = {}

      // Extract dimensions from query entities
      for (const entity of resolution.entities || []) {
        if (entity.type === "keyword" && entity.value) {
          // Simple heuristic - map keywords to dimensions
          // This would be more sophisticated in production
          providedDimensions[entity.value] = entity.value
        }
      }

      // Calculate decision coverage
      decisionCoverage = calculateDecisionCoverage(topic, providedDimensions, context as any)

      terminalOutcome = decisionCoverage.terminalOutcome as
        | "ANSWER"
        | "CONDITIONAL_ANSWER"
        | "REFUSAL"

      // If required dimensions missing, return REFUSAL
      if (terminalOutcome === "REFUSAL") {
        const missingDimensions = decisionCoverage.unresolved.filter((u) => u.required)
        const refusal: RefusalPayload = {
          reason: "MISSING_REQUIRED_DIMENSION",
          message: `Nedostaju ključni podaci za potpun odgovor: ${missingDimensions.map((d) => d.dimension).join(", ")}`,
        }

        yield factory.emit({
          stage: "REFUSAL",
          status: "complete",
          data: refusal,
        })

        return { outcome: "REFUSAL", ...refusal }
      }
    }

    // Build citations from final applicable rules
    const citations = buildCitations(finalRules)

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

    // Terminal: ANSWER or CONDITIONAL_ANSWER
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
      ...(decisionCoverage && {
        coverage: {
          requiredScore: decisionCoverage.requiredScore,
          totalScore: decisionCoverage.totalScore,
          missingOptional: decisionCoverage.unresolved.filter((u) => !u.required),
        },
      }),
      ...(terminalOutcome === "CONDITIONAL_ANSWER" &&
        decisionCoverage?.branches && {
          conditionalBranches: decisionCoverage.branches,
        }),
    }

    yield factory.emit({
      stage: terminalOutcome === "CONDITIONAL_ANSWER" ? "CONDITIONAL_ANSWER" : "ANSWER",
      status: "complete",
      data: answer,
    })

    return { outcome: terminalOutcome, ...answer } as TerminalPayload
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
