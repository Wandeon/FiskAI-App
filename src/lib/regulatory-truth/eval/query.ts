// src/lib/regulatory-truth/eval/query.ts
/**
 * Query Interface for Regulatory Truth Evaluation
 *
 * High-level API for answering regulatory questions.
 * Supports temporal selection via asOfDate parameter.
 */

import type { EvaluationContext, AnswerResult, Rule } from "./index"
import {
  evaluateRule,
  generateAnswer,
  VAT_REGISTRATION_RULE,
  getVatThresholdCitationLabel,
} from "./index"
import { isTemporallyEffective, getCurrentEffectiveDate } from "../utils/temporal-filter"

// =============================================================================
// Query Types
// =============================================================================

export type QueryType = "VAT_REGISTRATION"

export interface QueryInput {
  queryType: QueryType
  context: Partial<EvaluationContext>
  questionHr?: string
  /** Date for temporal rule selection. Defaults to today. */
  asOfDate?: Date
}

export interface QueryOutput {
  success: boolean
  queryType: QueryType
  answer: AnswerResult
  citationLabel: string
  /** The date used for temporal rule selection */
  asOfDate: Date
  /** Temporal selection details */
  temporalSelection?: {
    /** Whether rule was temporally selected */
    wasSelected: boolean
    /** Reason if selection failed */
    reason?: "EFFECTIVE" | "FUTURE" | "EXPIRED" | "NO_RULE_FOUND"
    /** The selected rule's effective dates */
    effectivePeriod?: {
      from: string | null
      until: string | null
    }
  }
  raw?: {
    evaluationResult: ReturnType<typeof evaluateRule>
  }
}

// =============================================================================
// Rule Registry (Static for now, will be DB-backed later)
// =============================================================================

/**
 * Topic key format: domain/area/subarea
 * Example: TAX/VAT/REGISTRATION
 */
type TopicKey = string

interface RegisteredRule {
  rule: Rule
  effectiveFrom: Date
  effectiveUntil: Date | null
  citationLabel: string
}

/**
 * Registry of rules by topic key.
 * Each topic can have multiple rules with different effective periods.
 * The selector will choose the correct one based on asOfDate.
 */
const RULE_REGISTRY: Map<TopicKey, RegisteredRule[]> = new Map([
  [
    "TAX/VAT/REGISTRATION",
    [
      {
        rule: VAT_REGISTRATION_RULE,
        effectiveFrom: new Date("2025-01-01"),
        effectiveUntil: null,
        citationLabel: getVatThresholdCitationLabel(),
      },
      // Future: add historical rules here
      // {
      //   rule: VAT_REGISTRATION_RULE_2024,
      //   effectiveFrom: new Date("2023-01-01"),
      //   effectiveUntil: new Date("2024-12-31"),
      //   citationLabel: "Zakon o PDV-u, čl. 90, st. 1 (NN xx/2023)",
      // },
    ],
  ],
])

/**
 * Select the correct rule for a topic at a given date.
 *
 * Selection algorithm:
 * 1. Get all rules for the topic
 * 2. Filter to those temporally effective at asOfDate
 * 3. If multiple remain, pick the one with the latest effectiveFrom (most recent amendment wins)
 * 4. If none remain, return null with reason
 */
function selectRule(
  topicKey: TopicKey,
  asOfDate: Date
):
  | { rule: RegisteredRule; reason: "EFFECTIVE" }
  | { rule: null; reason: "FUTURE" | "EXPIRED" | "NO_RULE_FOUND" } {
  const candidates = RULE_REGISTRY.get(topicKey)

  if (!candidates || candidates.length === 0) {
    return { rule: null, reason: "NO_RULE_FOUND" }
  }

  // Filter to effective rules
  const effective = candidates.filter(
    (r) =>
      isTemporallyEffective(
        { effectiveFrom: r.effectiveFrom, effectiveUntil: r.effectiveUntil },
        asOfDate
      ).isEffective
  )

  if (effective.length === 0) {
    // Check if all rules are future or expired
    const allResults = candidates.map((r) =>
      isTemporallyEffective(
        { effectiveFrom: r.effectiveFrom, effectiveUntil: r.effectiveUntil },
        asOfDate
      )
    )
    const hasFuture = allResults.some((r) => r.reason === "FUTURE")
    const hasExpired = allResults.some((r) => r.reason === "EXPIRED")

    // Prefer FUTURE if any (query date is before any rule), otherwise EXPIRED
    return { rule: null, reason: hasFuture ? "FUTURE" : hasExpired ? "EXPIRED" : "NO_RULE_FOUND" }
  }

  // If multiple effective rules, pick the one with latest effectiveFrom
  // (most recent amendment wins)
  const sorted = effective.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())

  return { rule: sorted[0], reason: "EFFECTIVE" }
}

// =============================================================================
// Query Handler
// =============================================================================

/**
 * Answer a regulatory question.
 *
 * Example:
 * ```
 * const result = answerQuery({
 *   queryType: "VAT_REGISTRATION",
 *   context: {
 *     taxpayer: {
 *       country: "HR",
 *       entityType: "OBRT",
 *       vat: { annualRevenueEurTrailing12m: 92000 }
 *     }
 *   },
 *   asOfDate: new Date("2025-06-15") // Optional, defaults to today
 * })
 * ```
 */
export function answerQuery(input: QueryInput): QueryOutput {
  const { queryType, context, asOfDate } = input
  const effectiveDate = asOfDate ?? getCurrentEffectiveDate()

  // Build full context with defaults
  const fullContext: EvaluationContext = {
    taxpayer: {
      country: context.taxpayer?.country ?? "HR",
      entityType: context.taxpayer?.entityType ?? "OTHER",
      vat: context.taxpayer?.vat ?? {},
    },
  }

  switch (queryType) {
    case "VAT_REGISTRATION": {
      // Temporal selection: find the correct rule for asOfDate
      const selection = selectRule("TAX/VAT/REGISTRATION", effectiveDate)

      // If no rule found, return error
      if (!selection.rule) {
        const reasonMessages: Record<string, string> = {
          NO_RULE_FOUND: "Nije pronađeno pravilo za ovaj upit.",
          FUTURE: `Pravilo za ovaj upit još nije stupilo na snagu (datum upita: ${effectiveDate.toISOString().split("T")[0]}).`,
          EXPIRED: `Nema važećeg pravila za ovaj datum (${effectiveDate.toISOString().split("T")[0]}).`,
        }

        return {
          success: false,
          queryType,
          answer: {
            answerHr: reasonMessages[selection.reason] ?? "Greška pri odabiru pravila.",
            evaluated: false,
            citations: [],
            confidence: "LOW",
          },
          citationLabel: "",
          asOfDate: effectiveDate,
          temporalSelection: {
            wasSelected: false,
            reason: selection.reason,
          },
        }
      }

      // Evaluate the selected rule
      const { rule: registeredRule } = selection
      const result = evaluateRule(registeredRule.rule, fullContext)
      const answer = generateAnswer(result, registeredRule.rule)

      return {
        success: result.success,
        queryType,
        answer,
        citationLabel: registeredRule.citationLabel,
        asOfDate: effectiveDate,
        temporalSelection: {
          wasSelected: true,
          reason: "EFFECTIVE",
          effectivePeriod: {
            from: registeredRule.effectiveFrom.toISOString().split("T")[0],
            until: registeredRule.effectiveUntil?.toISOString().split("T")[0] ?? null,
          },
        },
        raw: { evaluationResult: result },
      }
    }

    default:
      return {
        success: false,
        queryType,
        answer: {
          answerHr: `Nepoznata vrsta upita: ${queryType}`,
          evaluated: false,
          citations: [],
          confidence: "LOW",
        },
        citationLabel: "",
        asOfDate: effectiveDate,
      }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Answer "Moram li ući u PDV?" with just the revenue number.
 *
 * @param annualRevenueEur - Annual revenue in EUR (trailing 12 months)
 * @param entityType - Entity type (OBRT, DOO, JDOO, OTHER)
 * @param asOfDate - Date for temporal rule selection. Defaults to today.
 */
export function answerMoramLiUciUPdv(
  annualRevenueEur: number | undefined,
  entityType: "OBRT" | "DOO" | "JDOO" | "OTHER" = "OBRT",
  asOfDate?: Date
): QueryOutput {
  return answerQuery({
    queryType: "VAT_REGISTRATION",
    questionHr: "Moram li ući u PDV?",
    context: {
      taxpayer: {
        country: "HR",
        entityType,
        vat:
          annualRevenueEur !== undefined ? { annualRevenueEurTrailing12m: annualRevenueEur } : {},
      },
    },
    asOfDate,
  })
}

// =============================================================================
// Formatted Output
// =============================================================================

/**
 * Format query output for display.
 */
export function formatQueryOutput(output: QueryOutput): string {
  const lines: string[] = []

  // Answer
  lines.push(`📋 ${output.answer.answerHr}`)
  lines.push("")

  // Evaluation details
  if (output.answer.evaluated && output.answer.evaluation) {
    const { field, value, threshold, comparison } = output.answer.evaluation
    lines.push("📊 Evaluacija:")
    lines.push(`   Polje: ${field}`)
    lines.push(`   Vrijednost: ${(value as number).toLocaleString("hr-HR")} EUR`)
    lines.push(`   Prag: ${(threshold as number).toLocaleString("hr-HR")} EUR`)
    lines.push(`   Usporedba: ${value} ${comparison} ${threshold}`)
    lines.push("")
  }

  // Temporal selection info
  if (output.temporalSelection) {
    lines.push("📅 Temporalna selekcija:")
    lines.push(`   Datum upita: ${output.asOfDate.toISOString().split("T")[0]}`)
    if (output.temporalSelection.effectivePeriod) {
      const { from, until } = output.temporalSelection.effectivePeriod
      lines.push(`   Pravilo vrijedi: ${from} - ${until ?? "trajno"}`)
    }
    lines.push("")
  }

  // Citation
  if (output.citationLabel) {
    lines.push(`📖 Izvor: ${output.citationLabel}`)
  }

  // Confidence
  lines.push(`🎯 Pouzdanost: ${output.answer.confidence}`)

  // Missing field hint
  if (output.answer.missingField) {
    lines.push("")
    lines.push(`⚠️ Nedostaje: ${output.answer.missingField}`)
  }

  return lines.join("\n")
}
