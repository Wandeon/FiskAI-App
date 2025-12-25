// src/lib/assistant/query-engine/rule-selector.ts
import { prisma } from "@/lib/prisma"

const AUTHORITY_RANK: Record<string, number> = {
  LAW: 1,
  REGULATION: 2,
  GUIDANCE: 3,
  PRACTICE: 4,
}

export interface RuleCandidate {
  id: string
  conceptSlug: string
  titleHr: string
  authorityLevel: string
  status: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  confidence: number
  value: string
  valueType: string
  explanationHr: string | null
  sourcePointers: {
    id: string
    evidenceId: string
    exactQuote: string
    contextBefore: string | null
    contextAfter: string | null
    articleNumber: string | null
    lawReference: string | null
    evidence: {
      id: string
      url: string
      fetchedAt: Date | null
      source: {
        name: string
        url: string
      }
    }
  }[]
}

export async function selectRules(conceptSlugs: string[]): Promise<RuleCandidate[]> {
  if (conceptSlugs.length === 0) return []

  const now = new Date()

  const rules = await prisma.regulatoryRule.findMany({
    where: {
      conceptSlug: { in: conceptSlugs },
      status: "PUBLISHED",
      effectiveFrom: { lte: now },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
    },
    include: {
      sourcePointers: {
        include: {
          evidence: {
            include: {
              source: true,
            },
          },
        },
      },
    },
    orderBy: [
      { authorityLevel: "asc" }, // Will re-sort with rank
      { confidence: "desc" },
      { effectiveFrom: "desc" },
    ],
  })

  // Re-sort by authority rank (Prisma can't sort by custom rank)
  return rules.sort((a, b) => {
    const rankA = AUTHORITY_RANK[a.authorityLevel] ?? 99
    const rankB = AUTHORITY_RANK[b.authorityLevel] ?? 99
    if (rankA !== rankB) return rankA - rankB
    return b.confidence - a.confidence
  }) as RuleCandidate[]
}
