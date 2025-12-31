export type HardcodedIssueKind = "currency" | "percent" | "year" | "number"

export interface HardcodedValueHit {
  kind: HardcodedIssueKind
  match: string
  value: number
  index: number
  context: string
  reason: string
}

const currencyPattern = /\b\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?\s?(?:€|eur|eura|hrk|kn)\b/gi
const percentPattern = /\b\d{1,3}(?:[.,]\d+)?\s?%\b/g
const yearPattern = /\b20\d{2}\b/g
const numberPattern = /\b\d{4,7}\b/g

const keywordHints = [
  "pdv",
  "porez",
  "prag",
  "limit",
  "pausal",
  "pausalni",
  "doprinos",
  "stopa",
  "naknada",
  "prirez",
  "kapital",
  "obrt",
]

function stripDiacritics(input: string) {
  return input.normalize("NFD").replace(/\p{Diacritic}/gu, "")
}

function normalizeNumber(raw: string) {
  const cleaned = raw.replace(/[^0-9,.-]/g, "")
  const noSpaces = cleaned.replace(/\s+/g, "")
  const hasComma = noSpaces.includes(",")
  const normalized = hasComma
    ? noSpaces.replace(/\./g, "").replace(/,/g, ".")
    : noSpaces.replace(/\./g, "")

  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : 0
}

function buildContext(text: string, index: number, match: string) {
  const start = Math.max(0, index - 30)
  const end = Math.min(text.length, index + match.length + 30)
  return text.slice(start, end).replace(/\s+/g, " ").trim()
}

function matchesKeywords(context: string) {
  const normalized = stripDiacritics(context.toLowerCase())
  return keywordHints.some((hint) => normalized.includes(hint))
}

export function detectHardcodedValues(text: string, options?: { canonicalNumbers?: Set<number> }) {
  const hits: HardcodedValueHit[] = []
  const canonical = options?.canonicalNumbers
  const currentYear = new Date().getFullYear()

  for (const match of text.matchAll(currencyPattern)) {
    const value = normalizeNumber(match[0])
    const index = match.index ?? 0
    const context = buildContext(text, index, match[0])
    const shouldFlag = canonical ? canonical.has(value) : matchesKeywords(context)

    if (shouldFlag) {
      hits.push({
        kind: "currency",
        match: match[0],
        value,
        index,
        context,
        reason: "Currency value appears in copy; verify it is sourced from fiscal-data.",
      })
    }
  }

  for (const match of text.matchAll(percentPattern)) {
    const value = normalizeNumber(match[0])
    const index = match.index ?? 0
    const context = buildContext(text, index, match[0])
    const shouldFlag = canonical ? canonical.has(value) : matchesKeywords(context)

    if (shouldFlag) {
      hits.push({
        kind: "percent",
        match: match[0],
        value,
        index,
        context,
        reason: "Percent value appears in copy; verify it is sourced from fiscal-data.",
      })
    }
  }

  for (const match of text.matchAll(yearPattern)) {
    const value = normalizeNumber(match[0])
    const index = match.index ?? 0
    const context = buildContext(text, index, match[0])
    const shouldFlag = value < currentYear && matchesKeywords(context)

    if (shouldFlag) {
      hits.push({
        kind: "year",
        match: match[0],
        value,
        index,
        context,
        reason: "Year reference is earlier than current year; verify it is still accurate.",
      })
    }
  }

  for (const match of text.matchAll(numberPattern)) {
    const value = normalizeNumber(match[0])
    const index = match.index ?? 0
    const context = buildContext(text, index, match[0])
    const looksLikeYear = value >= 2000 && value <= 2100
    const shouldFlag =
      !looksLikeYear && (canonical ? canonical.has(value) : matchesKeywords(context))

    if (shouldFlag) {
      hits.push({
        kind: "number",
        match: match[0],
        value,
        index,
        context,
        reason: "Numeric value appears near fiscal keywords or matches canonical data.",
      })
    }
  }

  return hits
}
