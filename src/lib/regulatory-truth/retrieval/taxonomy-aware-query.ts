// src/lib/regulatory-truth/retrieval/taxonomy-aware-query.ts
import { db } from "@/lib/db"
import { expandQueryConcepts, type ExpandedQuery } from "../taxonomy/query-expansion"
import { resolveRulePrecedence } from "../agents/arbiter"
import { buildTemporalWhereClause, getCurrentEffectiveDate } from "../utils/temporal-filter"
import type { Prisma } from "@prisma/client"

export interface QueryResult {
  rules: Array<{
    id: string
    conceptSlug: string
    titleHr: string
    value: string
    valueType: string
    confidence: number
    isWinning: boolean
  }>
  expandedQuery: ExpandedQuery
  precedenceResolution?: {
    winningRuleId: string
    reasoning: string
    overriddenRuleIds: string[]
  }
}

/**
 * Execute a taxonomy-aware query
 *
 * 1. Expand query using taxonomy (synonyms, hypernyms)
 * 2. Find matching rules (filtered by temporal effectiveness)
 * 3. Resolve precedence if multiple rules match
 * 4. Return results with winning rule marked
 *
 * @param query The user's query
 * @param asOfDate Optional date for temporal filtering (defaults to current date)
 */
export async function executeQuery(query: string, asOfDate?: Date): Promise<QueryResult> {
  const effectiveDate = asOfDate ?? getCurrentEffectiveDate()

  // Step 1: Expand query
  const expanded = await expandQueryConcepts(query)

  // Step 2: Find rules matching expanded terms
  // Build OR conditions as an array
  const orConditions: Prisma.RegulatoryRuleWhereInput[] = []

  // Match by concept slug
  if (expanded.matchedConcepts.length > 0) {
    orConditions.push({ conceptSlug: { in: expanded.matchedConcepts } })
  }

  // Match by title using original terms
  if (expanded.originalTerms.length > 0) {
    orConditions.push({
      titleHr: {
        contains: expanded.originalTerms[0],
        mode: "insensitive",
      },
    })
  }

  // Build temporal filter for rules effective at the query date
  const temporalFilter = buildTemporalWhereClause(effectiveDate)

  // Build the where clause with temporal filtering
  const whereClause: Prisma.RegulatoryRuleWhereInput =
    orConditions.length > 0
      ? {
          AND: [{ OR: orConditions }, { status: "PUBLISHED" }, temporalFilter],
        }
      : {
          AND: [{ status: "PUBLISHED" }, temporalFilter],
        }

  const matchingRules = await db.regulatoryRule.findMany({
    where: whereClause,
    orderBy: [{ confidence: "desc" }, { effectiveFrom: "desc" }],
    take: 20,
  })

  const result: QueryResult = {
    rules: matchingRules.map((rule) => ({
      id: rule.id,
      conceptSlug: rule.conceptSlug,
      titleHr: rule.titleHr,
      value: rule.value,
      valueType: rule.valueType,
      confidence: rule.confidence,
      isWinning: false,
    })),
    expandedQuery: expanded,
  }

  // Step 3: Resolve precedence if multiple rules match
  if (matchingRules.length > 1) {
    const ruleIds = matchingRules.map((r) => r.id)
    const precedence = await resolveRulePrecedence(ruleIds)

    result.precedenceResolution = precedence

    // Mark winning rule
    result.rules = result.rules.map((rule) => ({
      ...rule,
      isWinning: rule.id === precedence.winningRuleId,
    }))
  } else if (matchingRules.length === 1) {
    result.rules[0].isWinning = true
  }

  return result
}

/**
 * Find VAT rate for a product using taxonomy
 *
 * @param productTerm The product term to search for
 * @param asOfDate Optional date for temporal filtering (defaults to current date)
 */
export async function findVatRate(
  productTerm: string,
  asOfDate?: Date
): Promise<{
  rate: string | null
  conceptPath: string[]
  reasoning: string
}> {
  const expanded = await expandQueryConcepts(productTerm)

  if (expanded.vatCategories.length > 0) {
    // Found VAT category directly through taxonomy
    return {
      rate: expanded.vatCategories[0],
      conceptPath: expanded.matchedConcepts,
      reasoning:
        "Found via taxonomy: " + productTerm + " -> " + expanded.matchedConcepts.join(" -> "),
    }
  }

  // Fall back to rule search (with temporal filtering)
  const result = await executeQuery("pdv stopa " + productTerm, asOfDate)

  if (result.rules.length > 0) {
    const winning = result.rules.find((r) => r.isWinning)
    if (winning && winning.valueType.includes("percentage")) {
      return {
        rate: winning.value,
        conceptPath: [winning.conceptSlug],
        reasoning: "Found via rule: " + winning.titleHr,
      }
    }
  }

  return {
    rate: null,
    conceptPath: [],
    reasoning: "No VAT rate found for: " + productTerm,
  }
}
