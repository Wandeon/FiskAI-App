// src/lib/regulatory-truth/utils/confidence-decay.ts
import { db } from "@/lib/db"

/**
 * Calculate confidence decay based on rule age.
 *
 * Decay schedule:
 * - 0-3 months: 0% decay
 * - 3-6 months: 5% decay
 * - 6-12 months: 10% decay
 * - 12-24 months: 20% decay
 * - 24+ months: 30% decay (cap)
 */
export function calculateConfidenceDecay(lastVerifiedAt: Date): number {
  const now = new Date()
  const ageMs = now.getTime() - lastVerifiedAt.getTime()
  const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000)

  if (ageMonths < 3) return 0
  if (ageMonths < 6) return 0.05
  if (ageMonths < 12) return 0.1
  if (ageMonths < 24) return 0.2
  return 0.3 // Cap at 30% decay
}

/**
 * Apply confidence decay to stale rules.
 * Returns count of rules updated.
 */
export async function applyConfidenceDecay(): Promise<{
  checked: number
  decayed: number
  details: Array<{
    ruleId: string
    oldConfidence: number
    newConfidence: number
    ageMonths: number
  }>
}> {
  // Get published/approved rules
  const rules = await db.regulatoryRule.findMany({
    where: {
      status: { in: ["PUBLISHED", "APPROVED"] },
    },
    select: {
      id: true,
      conceptSlug: true,
      confidence: true,
      updatedAt: true,
      riskTier: true,
    },
  })

  const details: Array<{
    ruleId: string
    oldConfidence: number
    newConfidence: number
    ageMonths: number
  }> = []

  let decayed = 0

  for (const rule of rules) {
    const decay = calculateConfidenceDecay(rule.updatedAt)

    if (decay > 0) {
      const newConfidence = Math.max(0.5, rule.confidence - decay) // Floor at 0.5

      // Only update if meaningful change
      if (Math.abs(newConfidence - rule.confidence) > 0.001) {
        await db.regulatoryRule.update({
          where: { id: rule.id },
          data: {
            confidence: newConfidence,
            reviewerNotes: JSON.stringify({
              temporal_decay_applied: true,
              previous_confidence: rule.confidence,
              decay_amount: decay,
              applied_at: new Date().toISOString(),
            }),
          },
        })

        const ageMs = Date.now() - rule.updatedAt.getTime()
        const ageMonths = Math.round(ageMs / (30 * 24 * 60 * 60 * 1000))

        details.push({
          ruleId: rule.id,
          oldConfidence: rule.confidence,
          newConfidence,
          ageMonths,
        })

        decayed++
        console.log(
          `[decay] ${rule.conceptSlug}: ${rule.confidence.toFixed(2)} → ${newConfidence.toFixed(2)} (${ageMonths} months old)`
        )
      }
    }
  }

  return { checked: rules.length, decayed, details }
}

/**
 * Get rules that need human re-validation due to age + low confidence.
 */
export async function getRulesNeedingRevalidation(
  maxConfidence: number = 0.75
): Promise<Array<{ id: string; conceptSlug: string; confidence: number; ageMonths: number }>> {
  const rules = await db.regulatoryRule.findMany({
    where: {
      status: { in: ["PUBLISHED", "APPROVED"] },
      confidence: { lte: maxConfidence },
    },
    select: {
      id: true,
      conceptSlug: true,
      confidence: true,
      updatedAt: true,
    },
    orderBy: { confidence: "asc" },
  })

  return rules.map((r) => ({
    id: r.id,
    conceptSlug: r.conceptSlug,
    confidence: r.confidence,
    ageMonths: Math.round((Date.now() - r.updatedAt.getTime()) / (30 * 24 * 60 * 60 * 1000)),
  }))
}
