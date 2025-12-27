import { AUTHORITY_RANK, type SourceCard, type CitationBlock } from "./types"

export type { SourceCard }

/**
 * Orders citations according to the frozen authority hierarchy.
 * Tie-breaker sequence:
 * 1. Authority rank: LAW > REGULATION > GUIDANCE > PRACTICE
 * 2. Effective date: newer first
 * 3. Confidence: higher first
 * 4. Source ID: alphabetical (stable tiebreaker)
 *
 * CRITICAL: Frontend MUST NOT reorder. This is the authoritative order.
 */
export function orderCitations(sources: SourceCard[]): SourceCard[] {
  return [...sources].sort((a, b) => {
    // 1. Authority rank
    const rankA = AUTHORITY_RANK[a.authority] ?? 999
    const rankB = AUTHORITY_RANK[b.authority] ?? 999
    if (rankA !== rankB) return rankA - rankB

    // 2. Effective date (newer first, null dates sort last)
    const dateA = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0
    const dateB = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0
    if (dateA !== dateB) return dateB - dateA

    // 3. Confidence (higher first)
    if (a.confidence !== b.confidence) return b.confidence - a.confidence

    // 4. ID (alphabetical, stable)
    return a.id.localeCompare(b.id)
  })
}

/**
 * Builds a CitationBlock with primary and supporting sources.
 * Primary is always the first (highest authority) source.
 */
export function buildCitationBlock(sources: SourceCard[]): CitationBlock | null {
  if (sources.length === 0) return null

  const ordered = orderCitations(sources)
  return {
    primary: ordered[0],
    supporting: ordered.slice(1),
  }
}
