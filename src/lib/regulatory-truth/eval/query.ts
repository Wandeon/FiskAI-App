// src/lib/regulatory-truth/eval/query.ts
/**
 * Query Interface for Regulatory Truth Evaluation
 *
 * High-level API for answering regulatory questions.
 */

import type { EvaluationContext, AnswerResult } from "./index"
import {
  evaluateRule,
  generateAnswer,
  VAT_REGISTRATION_RULE,
  getVatThresholdCitationLabel,
} from "./index"

// =============================================================================
// Query Types
// =============================================================================

export type QueryType = "VAT_REGISTRATION"

export interface QueryInput {
  queryType: QueryType
  context: Partial<EvaluationContext>
  questionHr?: string
}

export interface QueryOutput {
  success: boolean
  queryType: QueryType
  answer: AnswerResult
  citationLabel: string
  raw?: {
    evaluationResult: ReturnType<typeof evaluateRule>
  }
}

// =============================================================================
// Query Handler
// =============================================================================

/**
 * Answer a regulatory question.
 *
 * Example:
 * ```
 * const result = await answerQuery({
 *   queryType: "VAT_REGISTRATION",
 *   context: {
 *     taxpayer: {
 *       country: "HR",
 *       entityType: "OBRT",
 *       vat: { annualRevenueEurTrailing12m: 92000 }
 *     }
 *   }
 * })
 * ```
 */
export function answerQuery(input: QueryInput): QueryOutput {
  const { queryType, context } = input

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
      const result = evaluateRule(VAT_REGISTRATION_RULE, fullContext)
      const answer = generateAnswer(result, VAT_REGISTRATION_RULE)

      return {
        success: result.success,
        queryType,
        answer,
        citationLabel: getVatThresholdCitationLabel(),
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
      }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Answer "Moram li ući u PDV?" with just the revenue number.
 */
export function answerMoramLiUciUPdv(
  annualRevenueEur: number | undefined,
  entityType: "OBRT" | "DOO" | "JDOO" | "OTHER" = "OBRT"
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

  // Citation
  lines.push(`📖 Izvor: ${output.citationLabel}`)

  // Confidence
  lines.push(`🎯 Pouzdanost: ${output.answer.confidence}`)

  // Missing field hint
  if (output.answer.missingField) {
    lines.push("")
    lines.push(`⚠️ Nedostaje: ${output.answer.missingField}`)
  }

  return lines.join("\n")
}
