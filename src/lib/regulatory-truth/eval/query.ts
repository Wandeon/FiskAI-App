// src/lib/regulatory-truth/eval/query.ts
/**
 * Query Interface for Regulatory Truth Evaluation
 *
 * High-level API for answering regulatory questions.
 * Supports temporal selection via asOfDate parameter.
 */

import type { EvaluationContext, AnswerResult, Rule } from "./index"
import type { EdgeTrace } from "../graph/edge-types"
import {
  evaluateRule,
  generateAnswer,
  VAT_REGISTRATION_RULE,
  getVatThresholdCitationLabel,
} from "./index"
import { isTemporallyEffective, getCurrentEffectiveDate } from "../utils/temporal-filter"
// NOTE: Types imported separately to avoid pulling in DB
import type { RuleStore } from "./rule-store-types"
// Re-export nullRuleStore for convenience in tests
export { nullRuleStore } from "./rule-store-types"

// =============================================================================
// RuleStore Dependency Injection
// =============================================================================

/**
 * Module-level default RuleStore, lazily loaded from DB module.
 * Can be overridden via setDefaultRuleStore() for testing.
 */
let defaultRuleStore: RuleStore | null = null
let defaultStoreLoadAttempted = false

/**
 * Set the default RuleStore for production use.
 * Called automatically when first needed (lazy initialization).
 *
 * In unit tests, call setDefaultRuleStore(nullRuleStore) before tests
 * to prevent DB module loading.
 */
export function setDefaultRuleStore(store: RuleStore | null): void {
  defaultRuleStore = store
  defaultStoreLoadAttempted = true
}

/**
 * Get the default RuleStore (lazy-loaded from DB module).
 * Returns null if DB module unavailable (unit tests).
 */
async function getDefaultRuleStore(): Promise<RuleStore | null> {
  if (defaultStoreLoadAttempted) {
    return defaultRuleStore
  }

  try {
    const { dbRuleStore } = await import("./rule-store")
    defaultRuleStore = dbRuleStore
    defaultStoreLoadAttempted = true
    return defaultRuleStore
  } catch {
    // DB import failed (e.g., in unit tests) - use null
    defaultStoreLoadAttempted = true
    return null
  }
}

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
  /**
   * Optional RuleStore for dependency injection.
   * Defaults to DB-backed store in production.
   * Pass `nullRuleStore` in unit tests to avoid DB imports.
   */
  ruleStore?: RuleStore | null
}

/** Reasons for temporal selection outcome */
export type TemporalSelectionReason =
  | "EFFECTIVE"
  | "FUTURE" // Query date is before any rule's effectiveFrom
  | "EXPIRED" // Query date is after all rules' effectiveUntil
  | "NO_RULE_FOUND" // No rules exist for this topic
  | "NO_COVERAGE" // Rules exist but none cover this date (clearer than FUTURE for historical queries)
  | "CONFLICT_MULTIPLE_EFFECTIVE" // Multiple rules effective at same date without supersession

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
    reason?: TemporalSelectionReason
    /** The selected rule's effective dates */
    effectivePeriod?: {
      from: string | null
      until: string | null
    }
    /** Conflicting rule IDs if reason is CONFLICT_MULTIPLE_EFFECTIVE */
    conflictingRuleIds?: string[]
    /** Earliest available coverage date (for NO_COVERAGE) */
    earliestCoverageDate?: string
  }
  /**
   * Edge trace from the SRG showing how the selected rule was chosen.
   * Includes supersession chain and any override relationships.
   * Only populated when using DB-backed selection (selectRuleFromDb).
   */
  edgeTrace?: EdgeTrace
  /**
   * Rules that override the selected rule in specific contexts.
   * The evaluation may need to consider these overrides.
   */
  overridingRuleIds?: string[]
  /**
   * Which rule selection path was used.
   * "db" = selectRuleFromDb (preferred, has edge integration)
   * "static" = RULE_REGISTRY fallback (legacy, no edge integration)
   */
  selectionPath?: "db" | "static"
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

interface SelectionSuccess {
  rule: RegisteredRule
  reason: "EFFECTIVE"
}

interface SelectionFailure {
  rule: null
  reason: Exclude<TemporalSelectionReason, "EFFECTIVE">
  /** Earliest coverage date if reason is NO_COVERAGE/FUTURE */
  earliestCoverageDate?: string
  /** Conflicting rule IDs if reason is CONFLICT_MULTIPLE_EFFECTIVE */
  conflictingRuleIds?: string[]
}

type SelectionResult = SelectionSuccess | SelectionFailure

/**
 * Select the correct rule for a topic at a given date.
 *
 * Selection algorithm:
 * 1. Get all rules for the topic
 * 2. Filter to those temporally effective at asOfDate
 * 3. If multiple remain:
 *    a. Check for supersession chain (rule.supersedesId)
 *    b. If all but one are superseded, use the superseding rule
 *    c. Otherwise return CONFLICT_MULTIPLE_EFFECTIVE
 * 4. If single rule, return it
 * 5. If none remain, return appropriate reason with coverage info
 */
function selectRule(topicKey: TopicKey, asOfDate: Date): SelectionResult {
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
    // Find the earliest coverage date for helpful error message
    const sortedByFrom = [...candidates].sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
    )
    const earliestRule = sortedByFrom[0]
    const earliestCoverageDate = earliestRule.effectiveFrom.toISOString().split("T")[0]

    // Check if query date is before any coverage (NO_COVERAGE is clearer than FUTURE for users)
    const queryBeforeAllRules = candidates.every((r) => asOfDate < r.effectiveFrom)
    if (queryBeforeAllRules) {
      return {
        rule: null,
        reason: "NO_COVERAGE",
        earliestCoverageDate,
      }
    }

    // Check if query date is after all rules expired
    const queryAfterAllRules = candidates.every(
      (r) => r.effectiveUntil !== null && asOfDate >= r.effectiveUntil
    )
    if (queryAfterAllRules) {
      return { rule: null, reason: "EXPIRED" }
    }

    // Gap in coverage (between rules)
    return {
      rule: null,
      reason: "NO_COVERAGE",
      earliestCoverageDate,
    }
  }

  // Single effective rule - success
  if (effective.length === 1) {
    return { rule: effective[0], reason: "EFFECTIVE" }
  }

  // Multiple effective rules - check for supersession
  // Sort by effectiveFrom desc (most recent first)
  const sorted = [...effective].sort(
    (a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
  )

  // In the static registry, we don't have supersedesId yet
  // TODO: Add supersedesId to RegisteredRule when migrating to DB
  // For now, if multiple rules are effective, it's a conflict
  // UNLESS they have different effectiveFrom dates (take most recent)
  const uniqueDates = new Set(sorted.map((r) => r.effectiveFrom.getTime()))
  if (uniqueDates.size === sorted.length) {
    // All have different effectiveFrom dates - take most recent (safe heuristic)
    return { rule: sorted[0], reason: "EFFECTIVE" }
  }

  // Multiple rules with same effectiveFrom = conflict
  return {
    rule: null,
    reason: "CONFLICT_MULTIPLE_EFFECTIVE",
    conflictingRuleIds: sorted.map((r) => r.rule.ruleId),
  }
}

// =============================================================================
// Query Handler
// =============================================================================

/**
 * Answer a regulatory question.
 *
 * PHASE 1 TRANSITION (2026-01-20):
 * - Prefers DB path (selectRuleFromDb) for temporal selection + edge integration
 * - Falls back to static RULE_REGISTRY when DB has no rule
 * - Logs which path was used for monitoring
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
 *   },
 *   asOfDate: new Date("2025-06-15") // Optional, defaults to today
 * })
 * ```
 */
export async function answerQuery(input: QueryInput): Promise<QueryOutput> {
  const { queryType, context, asOfDate, ruleStore } = input
  const effectiveDate = asOfDate ?? getCurrentEffectiveDate()

  // Get the RuleStore (injected or default)
  const store = ruleStore !== undefined ? ruleStore : await getDefaultRuleStore()

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
      // ========================================
      // PHASE 1: Prefer DB path for temporal selection
      // ========================================
      // Try DB-backed selection first (has edge integration)
      // Uses dependency injection to allow unit tests without DB
      let selectionPath: "db" | "static" = "static"
      const dbResult = store ? await store.selectRule("TAX/VAT/REGISTRATION", effectiveDate) : null

      if (dbResult) {
        if (dbResult.success && dbResult.rule) {
          selectionPath = "db"
          console.log(`[query] Using DB path for VAT_REGISTRATION (rule ${dbResult.rule.id})`)
        } else if (dbResult.reason === "NO_RULE_FOUND") {
          // DB has no rule for this topic yet - fall back to static
          console.log(
            `[query] DB has no rule for TAX/VAT/REGISTRATION, falling back to static RULE_REGISTRY`
          )
        } else {
          // DB returned a failure reason (FUTURE, EXPIRED, CONFLICT, etc.)
          // Use the DB's answer - it's more authoritative
          selectionPath = "db"
          console.log(`[query] Using DB path for VAT_REGISTRATION (reason: ${dbResult.reason})`)
        }
      } else {
        // No RuleStore available (e.g., unit tests with nullRuleStore) - fall back to static
        console.log(`[query] RuleStore not available, falling back to static RULE_REGISTRY`)
      }

      // If DB path succeeded with a rule, use it for temporal info
      if (selectionPath === "db" && dbResult) {
        if (!dbResult.success || !dbResult.rule) {
          // DB returned a failure - propagate it
          const queryDateStr = effectiveDate.toISOString().split("T")[0]
          const reasonMessages: Record<TemporalSelectionReason, string> = {
            EFFECTIVE: "",
            NO_RULE_FOUND: "Nije pronađeno pravilo za ovaj upit.",
            NO_COVERAGE: dbResult.earliestCoverageDate
              ? `Nema podataka za datum ${queryDateStr}. Pokrivenost počinje od ${dbResult.earliestCoverageDate}.`
              : `Nema podataka za datum ${queryDateStr}.`,
            FUTURE: dbResult.earliestCoverageDate
              ? `Pravilo još nije stupilo na snagu. Vrijedi od ${dbResult.earliestCoverageDate}.`
              : `Pravilo za ovaj upit još nije stupilo na snagu.`,
            EXPIRED: `Pravilo je isteklo za datum ${queryDateStr}.`,
            CONFLICT_MULTIPLE_EFFECTIVE:
              `Pronađeno više pravila koja vrijede na datum ${queryDateStr}. ` +
              `Potrebna je ručna provjera.`,
          }

          return {
            success: false,
            queryType,
            answer: {
              answerHr: reasonMessages[dbResult.reason] ?? "Greška pri odabiru pravila.",
              evaluated: false,
              citations: [],
              confidence: "LOW",
            },
            citationLabel: "",
            asOfDate: effectiveDate,
            temporalSelection: {
              wasSelected: false,
              reason: dbResult.reason,
              earliestCoverageDate: dbResult.earliestCoverageDate,
              conflictingRuleIds: dbResult.conflictingRuleIds,
            },
            edgeTrace: dbResult.edgeTrace,
            selectionPath: "db",
          }
        }

        // ========================================
        // GRAPH STATUS CHECK: Block evaluation if graph is not CURRENT
        // ========================================
        // Rule can be PUBLISHED, but if graphStatus is STALE or PENDING,
        // we must refuse to evaluate and return "temporary system inconsistency"
        // (cite the rule text without evaluation)
        if (dbResult.graphStatus && dbResult.graphStatus !== "CURRENT") {
          console.warn(
            `[query] Graph status is ${dbResult.graphStatus} for rule ${dbResult.rule.id} - blocking evaluation`
          )

          // Build citation from DB rule info
          const citationLabel = `${dbResult.rule.titleHr} (${dbResult.rule.conceptSlug})`

          return {
            success: false,
            queryType,
            answer: {
              answerHr:
                "Privremena nekonzistentnost sustava. " +
                "Pravilo je pronađeno, ali evaluacija nije moguća dok se graf ne ažurira. " +
                `Referenca: ${citationLabel}. ` +
                "Molimo pokušajte ponovno za nekoliko minuta.",
              evaluated: false,
              citations: [], // Empty - no evaluated citations available in degraded mode
              confidence: "LOW",
            },
            citationLabel,
            asOfDate: effectiveDate,
            temporalSelection: {
              wasSelected: true,
              reason: "EFFECTIVE",
              effectivePeriod: dbResult.effectivePeriod,
            },
            edgeTrace: dbResult.edgeTrace,
            selectionPath: "db",
          }
        }

        // DB has a rule - use it for temporal info, but still use static Rule for evaluation
        // (The Rule DSL in RULE_REGISTRY is more expressive than DB schema)
        const staticRule = RULE_REGISTRY.get("TAX/VAT/REGISTRATION")?.[0]
        if (!staticRule) {
          // This shouldn't happen - static registry should always have this rule
          console.error("[query] Static RULE_REGISTRY missing VAT_REGISTRATION rule!")
          return {
            success: false,
            queryType,
            answer: {
              answerHr: "Interna greška: pravilo nije pronađeno u registru.",
              evaluated: false,
              citations: [],
              confidence: "LOW",
            },
            citationLabel: "",
            asOfDate: effectiveDate,
            selectionPath: "db",
          }
        }

        // Evaluate using static Rule, but return DB temporal info
        const result = evaluateRule(staticRule.rule, fullContext)
        const answer = generateAnswer(result, staticRule.rule)

        return {
          success: result.success,
          queryType,
          answer,
          citationLabel: staticRule.citationLabel,
          asOfDate: effectiveDate,
          temporalSelection: {
            wasSelected: true,
            reason: "EFFECTIVE",
            effectivePeriod: dbResult.effectivePeriod,
          },
          edgeTrace: dbResult.edgeTrace,
          overridingRuleIds: dbResult.overridingRuleIds,
          selectionPath: "db",
          raw: { evaluationResult: result },
        }
      }

      // ========================================
      // FALLBACK: Static RULE_REGISTRY path
      // ========================================
      const selection = selectRule("TAX/VAT/REGISTRATION", effectiveDate)

      if (!selection.rule) {
        // Type assertion: when rule is null, it's SelectionFailure
        const failure = selection as SelectionFailure
        const queryDateStr = effectiveDate.toISOString().split("T")[0]
        const reasonMessages: Record<TemporalSelectionReason, string> = {
          EFFECTIVE: "",
          NO_RULE_FOUND: "Nije pronađeno pravilo za ovaj upit.",
          NO_COVERAGE: failure.earliestCoverageDate
            ? `Nema podataka za datum ${queryDateStr}. Pokrivenost počinje od ${failure.earliestCoverageDate}.`
            : `Nema podataka za datum ${queryDateStr}.`,
          FUTURE: failure.earliestCoverageDate
            ? `Pravilo još nije stupilo na snagu. Vrijedi od ${failure.earliestCoverageDate}.`
            : `Pravilo za ovaj upit još nije stupilo na snagu.`,
          EXPIRED: `Pravilo je isteklo za datum ${queryDateStr}.`,
          CONFLICT_MULTIPLE_EFFECTIVE:
            `Pronađeno više pravila koja vrijede na datum ${queryDateStr}. ` +
            `Potrebna je ručna provjera.`,
        }

        return {
          success: false,
          queryType,
          answer: {
            answerHr: reasonMessages[failure.reason] ?? "Greška pri odabiru pravila.",
            evaluated: false,
            citations: [],
            confidence: "LOW",
          },
          citationLabel: "",
          asOfDate: effectiveDate,
          temporalSelection: {
            wasSelected: false,
            reason: failure.reason,
            earliestCoverageDate: failure.earliestCoverageDate,
            conflictingRuleIds: failure.conflictingRuleIds,
          },
          selectionPath: "static",
        }
      }

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
        selectionPath: "static",
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
export async function answerMoramLiUciUPdv(
  annualRevenueEur: number | undefined,
  entityType: "OBRT" | "DOO" | "JDOO" | "OTHER" = "OBRT",
  asOfDate?: Date
): Promise<QueryOutput> {
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
