// src/lib/regulatory-truth/utils/review-bundle.ts
// Daily Review Bundle Generator for T0/T1 rules requiring human review

import { cliDb as db } from "../cli-db"
import { RiskTier } from "@prisma/client"

export interface ReviewItem {
  id: string
  conceptSlug: string
  titleHr: string
  value: string
  valueType: string
  riskTier: string
  confidence: number
  sourceCount: number
  quotes: string[]
  urls: string[]
  waitingHours: number
  effectiveFrom: string
  domain: string
}

export interface ReviewBundle {
  generatedAt: string
  totalItems: number
  byRiskTier: Record<string, number>
  byDomain: Record<string, number>
  items: ReviewItem[]
  approveCommand: string
}

export interface GenerateOptions {
  maxItems?: number
  prioritize?: "risk" | "age"
  riskTiers?: RiskTier[] // Filter by specific risk tiers
}

/**
 * Generate a review bundle for pending T0/T1 rules
 */
export async function generateReviewBundle(options?: GenerateOptions): Promise<ReviewBundle> {
  const maxItems = options?.maxItems ?? 20
  const prioritize = options?.prioritize ?? "risk"
  const riskTiers = options?.riskTiers ?? [RiskTier.T0, RiskTier.T1]

  const now = new Date()

  // Get pending rules with source information
  const pendingRules = await db.regulatoryRule.findMany({
    where: {
      status: "PENDING_REVIEW",
      riskTier: { in: riskTiers },
    },
    include: {
      sourcePointers: {
        include: {
          evidence: { select: { url: true } },
        },
      },
    },
    orderBy:
      prioritize === "risk" ? [{ riskTier: "asc" }, { updatedAt: "asc" }] : [{ updatedAt: "asc" }],
    take: maxItems,
  })

  const items: ReviewItem[] = pendingRules.map((rule) => {
    const urls = rule.sourcePointers
      .map((sp: { evidence?: { url?: string | null } | null }) => sp.evidence?.url)
      .filter((url: string | null | undefined): url is string => url !== null && url !== undefined)
    const domain = rule.sourcePointers[0]?.domain || "unknown"

    return {
      id: rule.id,
      conceptSlug: rule.conceptSlug,
      titleHr: rule.titleHr,
      value: rule.value,
      valueType: rule.valueType,
      riskTier: rule.riskTier,
      confidence: rule.confidence,
      sourceCount: rule.sourcePointers.length,
      quotes: rule.sourcePointers.map((sp: { exactQuote: string }) => sp.exactQuote).slice(0, 3),
      urls: Array.from(new Set(urls)), // Deduplicate URLs
      waitingHours: (now.getTime() - rule.updatedAt.getTime()) / (1000 * 60 * 60),
      effectiveFrom: rule.effectiveFrom.toISOString().split("T")[0],
      domain,
    }
  })

  // Group by risk tier
  const byRiskTier: Record<string, number> = {}
  for (const item of items) {
    byRiskTier[item.riskTier] = (byRiskTier[item.riskTier] || 0) + 1
  }

  // Group by domain
  const byDomain: Record<string, number> = {}
  for (const item of items) {
    byDomain[item.domain] = (byDomain[item.domain] || 0) + 1
  }

  // Generate approve command
  const ruleIds = items.map((i) => i.id).join(",")
  const approveCommand = `npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "${ruleIds}"`

  return {
    generatedAt: now.toISOString(),
    totalItems: items.length,
    byRiskTier,
    byDomain,
    items,
    approveCommand,
  }
}

/**
 * Format review bundle as markdown
 */
export function formatBundleMarkdown(bundle: ReviewBundle): string {
  let md = `# Daily Review Bundle

**Generated:** ${bundle.generatedAt}
**Total items:** ${bundle.totalItems}
**By risk tier:** ${Object.entries(bundle.byRiskTier)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}
**By domain:** ${Object.entries(bundle.byDomain)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")}

---

## Quick Approve All

\`\`\`bash
${bundle.approveCommand}
\`\`\`

**Note:** This will approve all ${bundle.totalItems} rules in this bundle. Review each item below before running.

---

## Items for Review

`

  for (const item of bundle.items) {
    md += `### ${item.conceptSlug}

- **Title:** ${item.titleHr}
- **Value:** ${item.value} (${item.valueType})
- **Risk Tier:** ${item.riskTier}
- **Confidence:** ${(item.confidence * 100).toFixed(0)}%
- **Sources:** ${item.sourceCount}
- **Waiting:** ${item.waitingHours.toFixed(1)} hours
- **Effective From:** ${item.effectiveFrom}
- **Domain:** ${item.domain}

**Source quotes:**
${item.quotes.map((q, i) => `${i + 1}. "${q.slice(0, 200)}${q.length > 200 ? "..." : ""}"`).join("\n")}

**Source URLs:**
${item.urls.map((url, i) => `${i + 1}. ${url}`).join("\n")}

**Individual approve:**
\`\`\`bash
npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "${item.id}"
\`\`\`

**Individual reject:**
\`\`\`bash
npx tsx src/lib/regulatory-truth/scripts/approve-bundle.ts --ids "${item.id}" --reject
\`\`\`

---

`
  }

  return md
}

/**
 * Group review items by domain/category
 */
export function groupByDomain(items: ReviewItem[]): Record<string, ReviewItem[]> {
  const grouped: Record<string, ReviewItem[]> = {}

  for (const item of items) {
    if (!grouped[item.domain]) {
      grouped[item.domain] = []
    }
    grouped[item.domain].push(item)
  }

  return grouped
}

/**
 * Group review items by concept prefix (e.g., "pausalni", "vat", "pdv")
 */
export function groupByConcept(items: ReviewItem[]): Record<string, ReviewItem[]> {
  const grouped: Record<string, ReviewItem[]> = {}

  for (const item of items) {
    // Extract prefix from conceptSlug (e.g., "pausalni-revenue-threshold" -> "pausalni")
    const prefix = item.conceptSlug.split("-")[0] || "other"
    if (!grouped[prefix]) {
      grouped[prefix] = []
    }
    grouped[prefix].push(item)
  }

  return grouped
}
