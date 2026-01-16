import { nanoid } from "nanoid"
import {
  SCHEMA_VERSION,
  type AssistantResponse,
  type Surface,
  type Topic,
  type RefusalReason,
  type ClientContextBlock,
  STANDARD_DISCLAIMER,
  HIGH_RISK_DISCLAIMER,
} from "@/lib/assistant/types"
import { assistantLogger } from "@/lib/logger"
import { extractKeywords } from "./text-utils"
import { matchConcepts } from "./concept-matcher"
import { selectRules, type RuleSelectionContext } from "./rule-selector"
import { detectConflicts } from "./conflict-detector"
import { buildCitations } from "./citation-builder"
import {
  interpretQuery,
  shouldProceedToRetrieval,
  isJurisdictionValid,
  getRetrievalMode,
  CONFIDENCE_THRESHOLD_CLARIFY,
  CONFIDENCE_THRESHOLD_STRICT,
  type Interpretation,
} from "./query-interpreter"
import { prisma } from "@/lib/prisma"
import { generateContextualQuestions } from "./contextual-questions"
import {
  calculateEvidenceQuality,
  calculateFinalConfidence,
  calculateAggregateEvidenceQuality,
} from "./evidence-quality"
import { synthesizeAnswer, synthesizeMultiRuleAnswer } from "./answer-synthesizer"

/**
 * THREE-STAGE FAIL-CLOSED ANSWER BUILDER
 *
 * Stage 1: Query Interpretation (interpretQuery)
 *   - Classifies topic, intent, jurisdiction
 *   - Detects personalization needs, nonsense, foreign jurisdictions
 *   - Computes confidence score
 *   - CONFIDENCE TIERS:
 *     - < 0.6 → NEEDS_CLARIFICATION (always)
 *     - 0.6-0.75 → Stricter retrieval (need 2+ entities)
 *     - >= 0.75 → Normal retrieval
 *   - Nonsense → OUT_OF_SCOPE ("Please rephrase")
 *   - Foreign country → UNSUPPORTED_JURISDICTION
 *
 * Stage 2: Retrieval Gate (matchConcepts + selectRules)
 *   - Only runs if interpretation passes threshold
 *   - Strict token matching with minimum score
 *   - If no matches → NEEDS_CLARIFICATION (not NO_CITABLE_RULES for vague queries)
 *
 * Stage 3: Answer Eligibility Gate
 *   - Validates citations exist
 *   - Checks for unresolved conflicts
 *   - Validates personalization requirements
 *   - Only then builds the answer
 *
 * INVARIANT: The system REFUSES more often than it answers.
 * INVARIANT: Vague queries always get clarification, never "no sources found".
 */

// Fields that would be used for personalization
const PERSONALIZATION_FIELDS: Record<string, string[]> = {
  pausalni: ["yearlyRevenue", "businessType", "activityCode"],
  pdv: ["yearlyRevenue", "euTransactions", "vatRegistered"],
  doprinosi: ["businessType", "yearlyIncome", "employeeCount"],
  fiskalizacija: ["businessType", "cashTransactions", "posDevice"],
}

export async function buildAnswer(
  query: string,
  surface: Surface,
  companyId?: string
): Promise<AssistantResponse> {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`
  const createdAt = new Date().toISOString()

  // Base response fields
  const baseResponse = {
    schemaVersion: SCHEMA_VERSION,
    requestId,
    traceId,
    surface,
    createdAt,
  }

  // ============================================
  // STAGE 1: QUERY INTERPRETATION
  // ============================================
  const interpretation = await interpretQuery(query, surface)

  // Store interpretation for debugging (in non-production)
  const debugInfo = {
    interpretation: {
      topic: interpretation.topic,
      intent: interpretation.intent,
      jurisdiction: interpretation.jurisdiction,
      confidence: interpretation.confidence,
      entities: interpretation.entities,
      personalizationNeeded: interpretation.personalizationNeeded,
      matchedPatterns: interpretation.matchedPatterns,
      isNonsense: interpretation.isNonsense,
      nonsenseRatio: interpretation.nonsenseRatio,
      foreignCountryDetected: interpretation.foreignCountryDetected,
    },
  }

  // Helper for telemetry
  const emitTelemetry = (event: string, extra: Record<string, unknown> = {}) => {
    assistantLogger.info(
      {
        event,
        queryLength: query.length,
        tokenCount: interpretation.rawTokenCount,
        meaningfulTokenCount: interpretation.meaningfulTokenCount,
        detectedTopic: interpretation.topic,
        confidence: interpretation.confidence,
        surface,
        traceId,
        ...extra,
      },
      `assistant.interpretation.${event}`
    )
  }

  // ============================================
  // GATE 0A: NONSENSE DETECTION (before everything)
  // ============================================
  // If >60% of tokens are gibberish, return OUT_OF_SCOPE with "Please rephrase"
  if (interpretation.isNonsense) {
    emitTelemetry("nonsense_detected", { nonsenseRatio: interpretation.nonsenseRatio })
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic: "UNKNOWN" as Topic,
      headline: "Molimo preformulirajte upit",
      directAnswer: "",
      refusalReason: "OUT_OF_SCOPE" as RefusalReason,
      refusal: {
        message:
          "Nismo uspjeli razumjeti vaš upit. Molimo preformulirajte pitanje koristeći jasnije pojmove.",
        relatedTopics: [
          "Koja je stopa PDV-a u Hrvatskoj?",
          "Koji je prag za paušalni obrt?",
          "Kako fiskalizirati račun?",
          "Kada moram u sustav PDV-a?",
        ],
      },
    }
  }

  // GATE 0B: Confidence threshold (tiered: <0.6 always clarify)
  if (interpretation.confidence < CONFIDENCE_THRESHOLD_CLARIFY) {
    emitTelemetry("low_confidence", { threshold: CONFIDENCE_THRESHOLD_CLARIFY })
    return buildClarificationRefusal(baseResponse, interpretation)
  }

  // GATE 1B: Topic scope check
  if (interpretation.topic === "PRODUCT") {
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic: interpretation.topic,
      headline: "Pitanje o proizvodu",
      directAnswer: "",
      refusalReason: "OUT_OF_SCOPE",
      refusal: {
        message:
          "Za pitanja o FiskAI proizvodu, pretplati ili funkcijama, posjetite našu stranicu s cijenama ili kontaktirajte podršku.",
        redirectOptions: [
          { label: "Cijene", href: "/pricing", type: "DOCS" },
          { label: "Kontakt", href: "/contact", type: "CONTACT" },
        ],
      },
    }
  }

  if (interpretation.topic === "SUPPORT") {
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic: interpretation.topic,
      headline: "Tehnička podrška",
      directAnswer: "",
      refusalReason: "OUT_OF_SCOPE",
      refusal: {
        message: "Za tehničku podršku ili prijavu problema, kontaktirajte naš tim za podršku.",
        redirectOptions: [
          { label: "Podrška", href: "/support", type: "SUPPORT" },
          { label: "Kontakt", href: "/contact", type: "CONTACT" },
        ],
      },
    }
  }

  // GATE 1C: Foreign jurisdiction check
  // If user explicitly mentions a foreign country, refuse immediately
  if (interpretation.foreignCountryDetected) {
    const country = interpretation.foreignCountryDetected
    emitTelemetry("unsupported_jurisdiction", { foreignCountry: country })
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic: interpretation.topic,
      headline: "Nepodržana jurisdikcija",
      directAnswer: "",
      refusalReason: "UNSUPPORTED_JURISDICTION" as RefusalReason,
      refusal: {
        message: `Pitanje se odnosi na ${country}. Ovaj asistent odgovara samo na pitanja o hrvatskim i EU propisima koji se primjenjuju u Hrvatskoj. Za propise ${country === "Germany" ? "Njemačke" : country === "Austria" ? "Austrije" : country === "Slovenia" ? "Slovenije" : country === "Serbia" ? "Srbije" : country === "Bosnia" ? "BiH" : country === "Italy" ? "Italije" : country === "USA" ? "SAD-a" : country === "UK" ? "UK" : country}, konzultirajte lokalne stručnjake.`,
        relatedTopics: [
          "Porez na dohodak u Hrvatskoj",
          "PDV u Hrvatskoj",
          "Paušalni obrt u Hrvatskoj",
        ],
      },
    }
  }

  // GATE 1D: General jurisdiction validity check (for regulatory topics)
  if (interpretation.topic === "REGULATORY" && !isJurisdictionValid(interpretation)) {
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic: interpretation.topic,
      headline: "Nepodržana jurisdikcija",
      directAnswer: "",
      refusalReason: "UNSUPPORTED_JURISDICTION" as RefusalReason,
      refusal: {
        message:
          "Ovaj asistent odgovara samo na pitanja o hrvatskim i EU propisima. Za druge jurisdikcije, konzultirajte lokalne stručnjake.",
        relatedTopics: ["hrvatski porezni sustav", "PDV u Hrvatskoj", "paušalni obrt"],
      },
    }
  }

  // GATE 1E: Personalization check (before retrieval)
  if (interpretation.personalizationNeeded) {
    if (surface === "MARKETING") {
      return {
        ...baseResponse,
        kind: "REFUSAL",
        topic: interpretation.topic,
        headline: "Potrebni su podaci o poslovanju",
        directAnswer: "",
        refusalReason: "MISSING_CLIENT_DATA" as RefusalReason,
        refusal: {
          message:
            "Za personalizirani odgovor na ovo pitanje potrebni su podaci o vašem poslovanju. Prijavite se za pristup personaliziranim izračunima.",
          relatedTopics: ["porez na dohodak", "PDV pragovi", "paušalni obrt", "doprinosi"],
        },
      }
    } else if (surface === "APP" && !companyId) {
      const requiredFields = getRequiredFieldsFromEntities(interpretation.entities)
      return {
        ...baseResponse,
        kind: "REFUSAL",
        topic: interpretation.topic,
        headline: "Potrebni su podaci o poslovanju",
        directAnswer: "",
        refusalReason: "MISSING_CLIENT_DATA" as RefusalReason,
        refusal: {
          message:
            "Za personalizirani odgovor na ovo pitanje potrebni su podaci o vašem poslovanju. Molimo povežite vaš poslovni profil.",
        },
        clientContext: {
          used: [],
          completeness: {
            status: "NONE",
            score: 0,
          },
          missing: requiredFields.map((f) => ({
            label: f,
            impact: "Potrebno za personalizirani odgovor",
          })),
        },
      }
    }
    // APP surface with companyId: Continue to try to answer with client context
  }

  // ============================================
  // STAGE 2: RETRIEVAL GATE
  // ============================================

  // Fetch company data if companyId provided (for APP surface personalization)
  let company: Awaited<ReturnType<typeof fetchCompanyData>> | null = null
  if (companyId) {
    company = await fetchCompanyData(companyId)
  }

  // Build rule selection context with company data
  const selectionContext: RuleSelectionContext = {
    asOfDate: new Date(),
    ...(company && {
      companyData: {
        legalForm: company.legalForm ?? undefined,
        vatStatus: company.isVatPayer ? "REGISTERED" : "NOT_REGISTERED",
        // Map from Company fields - these would need to be added to schema
        // For now, we work with what we have
        activityNkd: undefined, // Not in current schema
        county: undefined, // Not in current schema
        revenueYtd: undefined, // Not in current schema
      },
    }),
  }

  // Extract keywords for concept matching
  const keywords = extractKeywords(query)

  // Match concepts
  const conceptMatches = await matchConcepts(keywords)

  if (conceptMatches.length === 0) {
    // INVARIANT: Vague queries get clarification, not "no sources found"
    // If confidence < 0.75, query is likely vague → ask for clarification
    if (interpretation.confidence < CONFIDENCE_THRESHOLD_STRICT) {
      emitTelemetry("needs_clarification", {
        reason: "no_concept_matches",
        threshold: CONFIDENCE_THRESHOLD_STRICT,
      })
      return buildClarificationRefusal(baseResponse, interpretation)
    }
    // Only return NO_CITABLE_RULES for specific queries with no matches
    emitTelemetry("no_citable_rules", { reason: "no_concept_matches" })
    return buildNoCitableRulesRefusal(baseResponse, interpretation.topic, interpretation)
  }

  // Select rules for matched concepts with company context
  const conceptSlugs = conceptMatches.map((c) => c.slug)
  const selectionResult = await selectRules(conceptSlugs, selectionContext)
  const rules = selectionResult.rules

  if (rules.length === 0) {
    // Same logic: vague queries get clarification
    if (interpretation.confidence < CONFIDENCE_THRESHOLD_STRICT) {
      emitTelemetry("needs_clarification", {
        reason: "no_rule_matches",
        threshold: CONFIDENCE_THRESHOLD_STRICT,
      })
      return buildClarificationRefusal(baseResponse, interpretation)
    }
    emitTelemetry("no_citable_rules", { reason: "no_rule_matches" })
    return buildNoCitableRulesRefusal(baseResponse, interpretation.topic, interpretation)
  }

  // ============================================
  // STAGE 3: ANSWER ELIGIBILITY GATE
  // ============================================

  // GATE 3A: Check for conflicts
  const conflictResult = detectConflicts(rules)

  if (conflictResult.hasConflict && !conflictResult.canResolve) {
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic: interpretation.topic,
      headline: "Proturječni propisi",
      directAnswer: "",
      refusalReason: "UNRESOLVED_CONFLICT",
      conflict: {
        status: "UNRESOLVED",
        description: conflictResult.description || "Višestruki izvori se ne slažu",
        sources: [],
      },
      refusal: {
        message:
          "Pronađeni su proturječni propisi za vaše pitanje. Preporučujemo konzultaciju sa stručnjakom.",
        conflictingSources: [],
      },
    }
  }

  // GATE 3B: Build citations (REQUIRED for ANSWER)
  const citations = buildCitations(rules)

  if (!citations) {
    return buildNoCitableRulesRefusal(baseResponse, interpretation.topic, interpretation)
  }

  // GATE 3C: Validate primary citation has required fields
  if (!citations.primary.quote || !citations.primary.url) {
    return buildNoCitableRulesRefusal(baseResponse, interpretation.topic, interpretation)
  }

  // ============================================
  // BUILD ANSWER (only if all gates pass)
  // ============================================

  const primaryRule = rules[0]

  // Build client context for APP surface
  let clientContext: ClientContextBlock | undefined
  if (surface === "APP") {
    if (interpretation.personalizationNeeded && companyId && company) {
      const requiredFields = getRequiredFieldsFromEntities(interpretation.entities)
      const usedFields = buildUsedFields(company)
      const missingFields = requiredFields.filter(
        (field) => !usedFields.some((used) => used.field === field)
      )

      clientContext = {
        used: usedFields,
        completeness: {
          status:
            missingFields.length === 0 ? "COMPLETE" : usedFields.length > 0 ? "PARTIAL" : "NONE",
          score: usedFields.length / Math.max(requiredFields.length, 1),
        },
        ...(missingFields.length > 0 && {
          missing: missingFields.map((f) => ({
            label: f,
            impact: "Poboljšalo bi točnost odgovora",
          })),
        }),
      }
    } else if (interpretation.personalizationNeeded && companyId && !company) {
      // Company not found
      const requiredFields = getRequiredFieldsFromEntities(interpretation.entities)
      clientContext = {
        used: [],
        completeness: {
          status: "NONE",
          score: 0,
        },
        missing: requiredFields.map((f) => ({
          label: f,
          impact: "Poboljšalo bi točnost odgovora",
        })),
      }
    } else if (!interpretation.personalizationNeeded) {
      clientContext = {
        used: [],
        completeness: {
          status: "COMPLETE",
          score: 1.0,
        },
      }
    }
  }

  // Determine obligation type (default to OBLIGATION for backward compatibility)
  const obligationType = (primaryRule.obligationType || "OBLIGATION") as ObligationType

  // Get obligation badge for UI
  const obligationBadge = getObligationBadge(obligationType)

  // === LLM-BASED ANSWER SYNTHESIS ===
  // Try to synthesize natural language answer using LLM
  // Fall back to template-based answer if LLM fails or is unavailable
  let headline = primaryRule.titleHr
  let directAnswer = ""

  const synthesisContext = {
    userQuery: query,
    rules: rules.slice(0, 3), // Use top 3 rules for synthesis
    primaryRule,
    surface,
    companyContext: company
      ? {
          legalForm: company.legalForm ?? undefined,
          vatStatus: company.isVatPayer ? "U sustavu PDV-a" : "Nije u sustavu PDV-a",
        }
      : undefined,
  }

  // Use multi-rule synthesis if we have multiple rules, otherwise single-rule
  const synthesized =
    rules.length > 1
      ? await synthesizeMultiRuleAnswer(synthesisContext)
      : await synthesizeAnswer(synthesisContext)

  if (synthesized) {
    // LLM synthesis successful - use synthesized answer
    headline = synthesized.headline
    directAnswer = synthesized.directAnswer

    assistantLogger.info(
      {
        query,
        method: "llm-synthesis",
        ruleCount: rules.length,
      },
      "Using LLM-synthesized answer"
    )
  } else {
    // Fall back to template-based answer construction
    directAnswer =
      primaryRule.explanationHr ||
      formatValueWithObligation(primaryRule.value, primaryRule.valueType, obligationType)

    assistantLogger.info(
      {
        query,
        method: "template-fallback",
        reason: "llm-synthesis-failed",
      },
      "Using template-based answer (LLM synthesis failed)"
    )
  }

  // Generate contextual related questions
  const relatedQuestions = await generateContextualQuestions({
    userQuery: query,
    retrievedRules: rules,
    conceptSlugs,
    surface,
    companyProfile: companyId
      ? {
          // Would be populated from actual company data
          // For now, we pass undefined to signal APP surface context
        }
      : undefined,
  })

  // === EVIDENCE-BASED CONFIDENCE CALCULATION ===
  // Calculate evidence quality for the primary rule
  const evidenceQuality = calculateEvidenceQuality(primaryRule)

  // Calculate aggregate evidence quality across all rules
  const aggregateEvidenceQuality = calculateAggregateEvidenceQuality(rules)

  // Combine query confidence (30%) with evidence quality (70%)
  const finalConfidence = calculateFinalConfidence(
    interpretation.confidence,
    evidenceQuality.overall
  )

  // Determine confidence level based on final score
  const confidenceLevel: "HIGH" | "MEDIUM" | "LOW" =
    finalConfidence >= 0.8 ? "HIGH" : finalConfidence >= 0.6 ? "MEDIUM" : "LOW"

  return {
    ...baseResponse,
    kind: "ANSWER",
    topic: interpretation.topic,
    headline,
    directAnswer,
    citations,
    confidence: {
      level: confidenceLevel,
      score: finalConfidence,
      breakdown: {
        queryConfidence: interpretation.confidence,
        evidenceQuality: evidenceQuality.overall,
        evidenceFactors: {
          freshness: evidenceQuality.factors.freshness,
          sourceCount: evidenceQuality.factors.sourceCount,
          authorityWeight: evidenceQuality.factors.authorityWeight,
          quoteQuality: evidenceQuality.factors.quoteQuality,
          temporalMargin: evidenceQuality.factors.temporalMargin,
        },
        evidenceDetails: {
          freshnessAgeInDays: evidenceQuality.breakdown.freshness.ageInDays,
          sourceCount: evidenceQuality.breakdown.sourceCount.count,
          authorityLevel: evidenceQuality.breakdown.authorityWeight.level,
          hasExactQuote: evidenceQuality.breakdown.quoteQuality.hasExactQuote,
          daysUntilExpiration: evidenceQuality.breakdown.temporalMargin.daysRemaining,
        },
      },
    },
    // Include obligation metadata for UI
    obligationContext: {
      type: obligationType,
      badge: obligationBadge,
      // For NO_OBLIGATION, include explicit messaging
      ...(obligationType === "NO_OBLIGATION" && {
        clarification: "Ova odredba označava izuzeće ili neprimjenjivost obveze.",
      }),
      // For CONDITIONAL, note that conditions apply
      ...(obligationType === "CONDITIONAL" && {
        clarification: "Ova vrijednost ovisi o dodatnim uvjetima navedenim u propisu.",
      }),
    },
    // Include ineligible rules info for transparency
    ...(selectionResult.hasMissingContext && {
      missingContext: {
        ruleCount: selectionResult.missingContextRuleIds.length,
        message:
          "Neki propisi nisu prikazani jer nedostaju podaci o vašem poslovanju potrebni za evaluaciju.",
      },
    }),
    relatedQuestions,
    ...(clientContext && { clientContext }),
    // Disclaimer (Appendix A: Safe Human-Removal Policy)
    disclaimer:
      primaryRule?.riskTier === "T0" || primaryRule?.riskTier === "T1"
        ? HIGH_RISK_DISCLAIMER
        : STANDARD_DISCLAIMER,
  }
}

// === HELPER FUNCTIONS ===

function buildClarificationRefusal(
  base: Partial<AssistantResponse>,
  interpretation: Interpretation
): AssistantResponse {
  return {
    ...base,
    kind: "REFUSAL",
    topic: interpretation.topic,
    headline: "Molimo precizirajte pitanje",
    directAnswer: "",
    refusalReason: "NEEDS_CLARIFICATION" as RefusalReason,
    refusal: {
      message:
        "Nismo sigurni što točno želite saznati. Molimo odaberite jedno od dolje navedenih pitanja ili preformulirajte upit.",
      relatedTopics: interpretation.suggestedClarifications || [
        "Koja je opća stopa PDV-a u Hrvatskoj?",
        "Koji je prag za paušalni obrt?",
        "Kako fiskalizirati račun?",
        "Kada moram u sustav PDV-a?",
      ],
    },
  } as AssistantResponse
}

function buildNoCitableRulesRefusal(
  base: Partial<AssistantResponse>,
  topic: Topic,
  interpretation?: Interpretation
): AssistantResponse {
  const suggestions = interpretation?.suggestedClarifications || [
    "porez na dohodak",
    "PDV stope",
    "paušalni obrt",
    "fiskalizacija",
  ]

  return {
    ...base,
    kind: "REFUSAL",
    topic,
    headline: "Nema dostupnih službenih izvora",
    directAnswer: "",
    refusalReason: "NO_CITABLE_RULES",
    refusal: {
      message: "Nismo pronašli službene izvore koji odgovaraju na vaše pitanje.",
      relatedTopics: suggestions,
    },
  } as AssistantResponse
}

function getRequiredFieldsFromEntities(entities: string[]): string[] {
  const requiredFields: string[] = []

  for (const entity of entities) {
    const entityLower = entity.toLowerCase()
    for (const [domain, fields] of Object.entries(PERSONALIZATION_FIELDS)) {
      if (entityLower.includes(domain) || domain.includes(entityLower)) {
        requiredFields.push(...fields)
      }
    }
  }

  // Default fields if no specific match
  if (requiredFields.length === 0) {
    requiredFields.push("yearlyRevenue", "businessType")
  }

  return [...new Set(requiredFields)]
}

type ObligationType = "OBLIGATION" | "NO_OBLIGATION" | "CONDITIONAL" | "INFORMATIONAL"

function formatValue(value: string, valueType: string): string {
  switch (valueType) {
    case "currency_eur":
      return `${parseFloat(value).toLocaleString("hr-HR")} EUR`
    case "currency_hrk":
      return `${parseFloat(value).toLocaleString("hr-HR")} HRK`
    case "percentage":
      return `${value}%`
    default:
      return value
  }
}

/**
 * Format the value with obligation context.
 * This ensures users understand whether a value is a requirement, exemption, or informational.
 */
function formatValueWithObligation(
  value: string,
  valueType: string,
  obligationType: ObligationType
): string {
  const formattedValue = formatValue(value, valueType)

  switch (obligationType) {
    case "NO_OBLIGATION":
      // Explicitly indicate no obligation applies
      return `Nema obveze: ${formattedValue}`
    case "CONDITIONAL":
      // Indicate the value depends on conditions
      return `Uvjetno: ${formattedValue}`
    case "INFORMATIONAL":
      // Reference value, not a requirement
      return `Referentna vrijednost: ${formattedValue}`
    case "OBLIGATION":
    default:
      return formattedValue
  }
}

/**
 * Get obligation badge for UI display.
 */
function getObligationBadge(obligationType: ObligationType): {
  text: string
  level: "high" | "medium" | "low" | "none"
} {
  switch (obligationType) {
    case "OBLIGATION":
      return { text: "Obveza", level: "high" }
    case "NO_OBLIGATION":
      return { text: "Nema obveze", level: "none" }
    case "CONDITIONAL":
      return { text: "Uvjetno", level: "medium" }
    case "INFORMATIONAL":
      return { text: "Informativno", level: "low" }
    default:
      return { text: "Obveza", level: "high" }
  }
}

// Removed generateRelatedQuestions - now using generateContextualQuestions from contextual-questions.ts

/**
 * Fetch company data for personalization context.
 * Returns null if company not found.
 */
async function fetchCompanyData(companyId: string) {
  return await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      legalForm: true,
      isVatPayer: true,
      oib: true,
      // Add more fields as they become available in schema
      // activityNkd: true,
      // county: true,
      // revenueYtd: true,
    },
  })
}

/**
 * Build list of used fields from company data for client context.
 */
function buildUsedFields(
  company: NonNullable<Awaited<ReturnType<typeof fetchCompanyData>>>
): Array<{ field: string; value: string; label: string; source: string }> {
  const used: Array<{ field: string; value: string; label: string; source: string }> = []

  if (company.legalForm) {
    used.push({
      field: "legalForm",
      value: company.legalForm,
      label: "Pravni oblik",
      source: "company_profile",
    })
  }

  if (company.isVatPayer !== null && company.isVatPayer !== undefined) {
    used.push({
      field: "isVatPayer",
      value: company.isVatPayer ? "U sustavu PDV-a" : "Nije u sustavu PDV-a",
      label: "PDV status",
      source: "company_profile",
    })
  }

  // Add more fields as they become available
  // if (company.activityNkd) {
  //   used.push({ field: "Djelatnost (NKD)", value: company.activityNkd })
  // }

  return used
}

// Re-export types for API layer
export type { ConceptMatch } from "./concept-matcher"
export type { RuleCandidate } from "./rule-selector"
export type { ConflictResult } from "./conflict-detector"
export type { Interpretation } from "./query-interpreter"
