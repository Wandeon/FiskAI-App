// src/lib/regulatory-truth/taxonomy/precedence-builder.ts
import { db } from "@/lib/db"
import { createEdgeWithCycleCheck, CycleDetectedError } from "../graph/cycle-detection"

export interface PrecedenceEdge {
  fromRuleId: string
  toRuleId: string
  notes: string
}

/**
 * Create OVERRIDES edges from ClaimException records
 *
 * When a claim has exceptions, those exceptions point to rules that
 * override the general rule in specific circumstances.
 */
export async function buildOverridesEdges(): Promise<{
  created: number
  skipped: number
  errors: string[]
}> {
  let created = 0
  let skipped = 0
  const errors: string[] = []

  // Find all claims with exceptions
  const claimsWithExceptions = await db.atomicClaim.findMany({
    where: {
      exceptions: { some: {} },
    },
    include: {
      exceptions: true,
      rule: true,
    },
  })

  for (const claim of claimsWithExceptions) {
    if (!claim.rule) {
      // Claim not linked to a rule yet
      continue
    }

    for (const exception of claim.exceptions) {
      // Find the rule that this exception points to
      const overridingRule = await db.regulatoryRule.findFirst({
        where: { conceptSlug: exception.overridesTo },
      })

      if (!overridingRule) {
        errors.push(`Rule not found for exception: ${exception.overridesTo}`)
        continue
      }

      // Check if edge already exists
      const existingEdge = await db.graphEdge.findUnique({
        where: {
          fromRuleId_toRuleId_relation: {
            fromRuleId: overridingRule.id,
            toRuleId: claim.rule.id,
            relation: "OVERRIDES",
          },
        },
      })

      if (existingEdge) {
        skipped++
        continue
      }

      // Create OVERRIDES edge: specific rule → general rule
      try {
        await createEdgeWithCycleCheck({
          fromRuleId: overridingRule.id, // The specific rule
          toRuleId: claim.rule.id, // The general rule being overridden
          relation: "OVERRIDES",
          validFrom: new Date(),
          notes: `From ClaimException: ${exception.condition} (${exception.sourceArticle})`,
        })
        created++
      } catch (error) {
        if (error instanceof CycleDetectedError) {
          errors.push(
            `Cycle prevented: OVERRIDES edge ${overridingRule.id} -> ${claim.rule.id} would create a cycle`
          )
        } else {
          throw error
        }
      }
    }
  }

  console.log(`[precedence] Created ${created} OVERRIDES edges, skipped ${skipped} existing`)

  return { created, skipped, errors }
}

/**
 * Find all rules that override a given rule
 */
export async function findOverridingRules(ruleId: string): Promise<string[]> {
  const edges = await db.graphEdge.findMany({
    where: {
      toRuleId: ruleId,
      relation: "OVERRIDES",
    },
    select: { fromRuleId: true },
  })

  return edges.map((e) => e.fromRuleId)
}

/**
 * Find all rules that a given rule overrides
 */
export async function findOverriddenRules(ruleId: string): Promise<string[]> {
  const edges = await db.graphEdge.findMany({
    where: {
      fromRuleId: ruleId,
      relation: "OVERRIDES",
    },
    select: { toRuleId: true },
  })

  return edges.map((e) => e.toRuleId)
}

/**
 * Check if rule A overrides rule B (directly or transitively)
 */
export async function doesOverride(ruleAId: string, ruleBId: string): Promise<boolean> {
  const visited = new Set<string>()
  const queue = [ruleAId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const overridden = await findOverriddenRules(current)

    if (overridden.includes(ruleBId)) {
      return true
    }

    queue.push(...overridden)
  }

  return false
}
