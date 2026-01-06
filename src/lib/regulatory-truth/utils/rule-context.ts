// src/lib/regulatory-truth/utils/rule-context.ts
import { db, dbReg } from "@/lib/db"

export interface RuleContext {
  ruleId: string
  conceptSlug: string
  value: string
  exactQuote: string
  sourceUrl: string
  fetchedAt: Date
  articleNumber?: string
  lawReference?: string
}

/**
 * Find published rules relevant to a user query.
 * Returns rules with their source evidence for citations.
 */
export async function findRelevantRules(query: string, limit: number = 5): Promise<RuleContext[]> {
  const keywords = extractKeywords(query)

  if (keywords.length === 0) {
    console.log("[rule-context] No keywords extracted from query:", query)
    return []
  }

  const rules = await db.regulatoryRule.findMany({
    where: {
      status: "PUBLISHED",
      OR: keywords.flatMap((kw) => [
        { conceptSlug: { contains: kw, mode: "insensitive" } },
        { titleHr: { contains: kw, mode: "insensitive" } },
      ]),
    },
    include: {
      sourcePointers: { take: 1 },
    },
    take: limit,
    orderBy: { confidence: "desc" },
  })

  // Collect evidence IDs and fetch from regulatory schema
  const evidenceIds = rules
    .flatMap((r) => r.sourcePointers.map((sp) => sp.evidenceId))
    .filter((id): id is string => id !== null)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    select: { id: true, url: true, fetchedAt: true },
  })
  const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]))

  return rules
    .filter(
      (rule) =>
        rule.sourcePointers.length > 0 && evidenceMap.has(rule.sourcePointers[0]!.evidenceId)
    )
    .map((rule) => {
      const pointer = rule.sourcePointers[0]!
      const evidence = evidenceMap.get(pointer.evidenceId)!
      return {
        ruleId: rule.id,
        conceptSlug: rule.conceptSlug,
        value: rule.value,
        exactQuote: pointer.exactQuote,
        sourceUrl: evidence.url,
        fetchedAt: evidence.fetchedAt,
        articleNumber: pointer.articleNumber || undefined,
        lawReference: pointer.lawReference || undefined,
      }
    })
}

/**
 * Normalize Croatian diacritics to ASCII for slug matching.
 * š→s, č→c, ć→c, ž→z, đ→d
 */
function normalizeDiacritics(text: string): string {
  return text
    .replace(/š/g, "s")
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d")
    .replace(/Š/g, "S")
    .replace(/Č/g, "C")
    .replace(/Ć/g, "C")
    .replace(/Ž/g, "Z")
    .replace(/Đ/g, "D")
}

function extractKeywords(query: string): string[] {
  // Stopwords in both normalized and original forms
  const stopwords = new Set([
    "sto",
    "što", // what
    "koja",
    "koji",
    "kako",
    "koliko",
    "je",
    "su",
    "za",
    "od",
    "do",
    "u",
    "na",
    "s",
    "i",
    "a",
    "li",
    "biti",
    "moze",
    "može", // can
    "hoce",
    "hoće", // will
    "kada",
    "gdje",
  ])

  const cleanQuery = query.toLowerCase().replace(/[^\w\sčćžšđ]/g, "")
  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 2 && !stopwords.has(w))

  // Return both original Croatian and normalized ASCII versions for better matching
  // This allows matching titleHr (with diacritics) and conceptSlug (ASCII)
  const result = new Set<string>()
  for (const word of words.slice(0, 5)) {
    result.add(word) // Original (may have diacritics)
    const normalized = normalizeDiacritics(word)
    if (normalized !== word) {
      result.add(normalized) // ASCII version
    }
  }
  return Array.from(result).slice(0, 8) // Allow up to 8 keywords (original + normalized)
}

/**
 * Format rule context for LLM system prompt injection.
 */
export function formatRulesForPrompt(rules: RuleContext[]): string {
  if (rules.length === 0) return ""

  const rulesList = rules
    .map(
      (r, i) =>
        `[${i + 1}] ${r.conceptSlug}
    Value: ${r.value}
    Quote: "${r.exactQuote}"
    Source: ${r.sourceUrl}
    ${r.articleNumber ? `Article: ${r.articleNumber}` : ""}
    ${r.lawReference ? `Law: ${r.lawReference}` : ""}`
    )
    .join("\n\n")

  return `
RELEVANT REGULATORY RULES (cite these in your answer):
${rulesList}

CITATION INSTRUCTIONS:
- Reference rules by number [1], [2], etc.
- Include the exact quote when stating values
- Mention the source URL for verification
`.trim()
}
