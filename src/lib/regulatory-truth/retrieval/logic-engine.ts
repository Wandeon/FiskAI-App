// src/lib/regulatory-truth/retrieval/logic-engine.ts
import { db } from "@/lib/db"
import { expandQueryConcepts } from "../taxonomy/query-expansion"
import { resolveRulePrecedence } from "../agents/arbiter"
import { buildTemporalWhereClause, getCurrentEffectiveDate } from "../utils/temporal-filter"

export interface LogicEngineResult {
  success: boolean
  answer: {
    value: string | null
    valueType: string | null
    assertion: string | null
    conditions: string[]
    exceptions: string[]
  }
  rules: Array<{
    id: string
    conceptSlug: string
    titleHr: string
    value: string
    confidence: number
    isWinning: boolean
  }>
  claims: Array<{
    id: string
    subjectType: string
    assertionType: string
    logicExpr: string
    triggerExpr: string | null
    exactQuote: string
  }>
  expandedTerms: string[]
  reasoning: string
}

/**
 * Logic Engine - handles threshold, rate, and obligation queries
 *
 * Examples:
 * - "Do I owe VAT if I sold 5,000 EUR?"
 * - "What is the VAT rate for juice?"
 * - "Am I required to register if revenue > 10,000 EUR?"
 *
 * @param query The user's query
 * @param entities Extracted entities from query classification
 * @param asOfDate Optional date for temporal filtering (defaults to current date)
 */
export async function runLogicEngine(
  query: string,
  entities: { subjects: string[]; conditions: string[]; products: string[] },
  asOfDate?: Date
): Promise<LogicEngineResult> {
  const effectiveDate = asOfDate ?? getCurrentEffectiveDate()
  const result: LogicEngineResult = {
    success: false,
    answer: {
      value: null,
      valueType: null,
      assertion: null,
      conditions: [],
      exceptions: [],
    },
    rules: [],
    claims: [],
    expandedTerms: [],
    reasoning: "",
  }

  // Step 1: Expand query with taxonomy
  const expanded = await expandQueryConcepts(query)
  result.expandedTerms = expanded.expandedTerms

  // Step 2: Search for matching atomic claims
  const claimWhereConditions: Array<Record<string, unknown>> = []

  // Match by subject type qualifiers
  if (entities.subjects.length > 0) {
    claimWhereConditions.push({
      subjectQualifiers: {
        hasSome: entities.subjects,
      },
    })
  }

  // Match by logic expression containing query terms
  if (expanded.expandedTerms.length > 0) {
    claimWhereConditions.push({
      OR: expanded.expandedTerms.map((term) => ({
        logicExpr: { contains: term, mode: "insensitive" as const },
      })),
    })
  }

  // Match by exact quote
  if (expanded.originalTerms.length > 0) {
    claimWhereConditions.push({
      OR: expanded.originalTerms.map((term) => ({
        exactQuote: { contains: term, mode: "insensitive" as const },
      })),
    })
  }

  // Only query if we have conditions
  if (claimWhereConditions.length > 0) {
    const claims = await db.atomicClaim.findMany({
      where: {
        OR: claimWhereConditions,
      },
      include: {
        exceptions: true,
        rule: true,
      },
      take: 10,
    })

    result.claims = claims.map((c) => ({
      id: c.id,
      subjectType: c.subjectType,
      assertionType: c.assertionType,
      logicExpr: c.logicExpr,
      triggerExpr: c.triggerExpr,
      exactQuote: c.exactQuote,
    }))
  }

  // Step 3: Search for matching rules
  const ruleWhereConditions: Array<Record<string, unknown>> = []

  // Match by concept slug
  if (expanded.matchedConcepts.length > 0) {
    ruleWhereConditions.push({ conceptSlug: { in: expanded.matchedConcepts } })
  }

  // Match by title containing original terms
  if (expanded.originalTerms.length > 0 && expanded.originalTerms[0]) {
    ruleWhereConditions.push({
      titleHr: {
        contains: expanded.originalTerms[0],
        mode: "insensitive" as const,
      },
    })
  }

  // Only query if we have conditions
  if (ruleWhereConditions.length > 0) {
    // Build temporal filter for rules effective at the query date
    const temporalFilter = buildTemporalWhereClause(effectiveDate)

    const rules = await db.regulatoryRule.findMany({
      where: {
        AND: [{ OR: ruleWhereConditions }, { status: "PUBLISHED" }, temporalFilter],
      },
      orderBy: [{ confidence: "desc" }],
      take: 10,
    })

    result.rules = rules.map((r) => ({
      id: r.id,
      conceptSlug: r.conceptSlug,
      titleHr: r.titleHr,
      value: r.value,
      confidence: r.confidence,
      isWinning: false,
    }))
  }

  // Step 4: Resolve precedence if multiple rules
  if (result.rules.length > 1) {
    const precedence = await resolveRulePrecedence(result.rules.map((r) => r.id))
    result.rules = result.rules.map((r) => ({
      ...r,
      isWinning: r.id === precedence.winningRuleId,
    }))
    result.reasoning = precedence.reasoning
  } else if (result.rules.length === 1) {
    result.rules[0].isWinning = true
    result.reasoning = "Single rule matched"
  }

  // Step 5: Build answer from winning rule or best claim
  const winningRule = result.rules.find((r) => r.isWinning)
  const bestClaim = result.claims[0]

  if (winningRule) {
    result.answer = {
      value: winningRule.value,
      valueType: null, // Would need to get from full rule
      assertion: null,
      conditions: [],
      exceptions: [],
    }
    result.success = true
  } else if (bestClaim) {
    // Get exceptions from the original claim data
    const claimWithExceptions = await db.atomicClaim.findUnique({
      where: { id: bestClaim.id },
      include: { exceptions: true },
    })

    result.answer = {
      value: bestClaim.logicExpr,
      valueType: null,
      assertion: bestClaim.assertionType,
      conditions: bestClaim.triggerExpr ? [bestClaim.triggerExpr] : [],
      exceptions: claimWithExceptions?.exceptions?.map((e) => e.condition) ?? [],
    }
    result.success = true
    result.reasoning = `Found via atomic claim: ${bestClaim.assertionType}`
  } else {
    result.reasoning = "No matching rules or claims found"
  }

  return result
}
