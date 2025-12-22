// src/lib/regulatory-truth/utils/content-cleaner.ts
// Per-source content cleaning to remove navigation noise and extract actual content

/**
 * Decode HTML entities to readable text
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&#263;": "ć",
    "&#262;": "Ć",
    "&#269;": "č",
    "&#268;": "Č",
    "&#273;": "đ",
    "&#272;": "Đ",
    "&#353;": "š",
    "&#352;": "Š",
    "&#382;": "ž",
    "&#381;": "Ž",
  }

  let result = text
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "g"), char)
  }

  // Handle numeric entities (&#NNN;)
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))

  return result
}

/**
 * Common footer markers that indicate end of content
 */
const FOOTER_MARKERS = [
  "Copyright ©",
  "Copyright &copy;",
  "Sva prava pridržana",
  "Povratak na vrh",
  "Natrag na vrh",
  "Politika privatnosti",
  "Uvjeti korištenja",
  "Izjava o pristupačnosti",
  "Kolačići",
  "kolačića",
  "Podnožje",
  "Footer",
]

/**
 * Common navigation markers that indicate start of navigation
 */
const NAV_MARKERS = [
  "Preskoči na glavni sadržaj",
  "Preskočite na glavni sadržaj",
  "Skoči na glavni sadržaj",
  "Skip to main content",
  "Glavni izbornik",
  "Izbornik",
  "Navigacija",
]

/**
 * Find the index where actual content starts (after navigation)
 */
function findContentStart(text: string): number {
  // Look for date patterns that indicate news items
  // Format: DD.MM.YYYY or DD.MM.YYYY. (Croatian date format, trailing period optional)
  const datePattern = /\d{1,2}\.\d{1,2}\.\d{4}\.?\s/
  const match = text.match(datePattern)

  if (match && match.index !== undefined) {
    // Start exactly at the date - don't go back
    return match.index
  }

  // Fallback: look for navigation end markers
  for (const marker of NAV_MARKERS) {
    const idx = text.indexOf(marker)
    if (idx !== -1) {
      return idx + marker.length
    }
  }

  return 0
}

/**
 * Find the index where actual content ends (before footer)
 */
function findContentEnd(text: string): number {
  let earliestFooter = text.length

  for (const marker of FOOTER_MARKERS) {
    const idx = text.indexOf(marker)
    if (idx !== -1 && idx < earliestFooter) {
      earliestFooter = idx
    }
  }

  // Also look for pagination markers
  const paginationPatterns = [
    /\n\s*\d+\s+\d+\s+\d+.*>>\s*/,
    /Prethodna\s+Stranica\s+\d+/,
    /Sljedeća\s*$/m,
    />> Sljedeća/,
  ]

  for (const pattern of paginationPatterns) {
    const match = text.match(pattern)
    if (match && match.index !== undefined && match.index < earliestFooter) {
      earliestFooter = match.index
    }
  }

  return earliestFooter
}

/**
 * Clean news/vijesti page content
 * These pages have: [NAV] [NEWS ITEMS with dates] [FOOTER]
 */
function cleanNewsPage(content: string): string {
  // First decode HTML entities
  let text = decodeHtmlEntities(content)

  // Remove excessive whitespace but keep structure
  text = text.replace(/\s+/g, " ").trim()

  // Find content boundaries
  const start = findContentStart(text)
  const end = findContentEnd(text)

  if (start >= end) {
    // Fallback: just return decoded content
    return text
  }

  let cleaned = text.substring(start, end).trim()

  // Clean up remaining noise
  cleaned = cleaned
    .replace(/\s*\|\s*/g, " | ") // Normalize separators
    .replace(/\s{2,}/g, " ") // Remove multiple spaces
    .replace(/Saznajte više/g, "\n") // Use "Learn more" as item separator
    .replace(/\.{3,}/g, "...") // Normalize ellipsis
    .trim()

  return cleaned
}

/**
 * Clean HZMO content (mirovinsko.hr)
 */
function cleanHzmoContent(content: string): string {
  return cleanNewsPage(content)
}

/**
 * Clean HZZO content (hzzo.hr)
 */
function cleanHzzoContent(content: string): string {
  return cleanNewsPage(content)
}

/**
 * Clean Porezna uprava content (porezna-uprava.hr)
 */
function cleanPoreznaContent(content: string): string {
  let text = cleanNewsPage(content)

  // Porezna has specific category separators
  // Format: DD.MM.YYYY. | Category | Title...
  // Keep this structure but clean it up
  text = text.replace(/\u200B/g, "") // Remove zero-width spaces

  return text
}

/**
 * Clean FINA content (fina.hr)
 */
function cleanFinaContent(content: string): string {
  return cleanNewsPage(content)
}

/**
 * Clean Ministry of Finance content (mfin.gov.hr)
 */
function cleanMfinContent(content: string): string {
  return cleanNewsPage(content)
}

/**
 * Clean Narodne novine content (narodne-novine.nn.hr)
 * This is typically structured law text, different from news
 */
function cleanNarodneNovineContent(content: string): string {
  let text = decodeHtmlEntities(content)

  // For NN, we want to preserve the structure more
  // Just remove navigation and footer
  const start = findContentStart(text)
  const end = findContentEnd(text)

  if (start < end) {
    text = text.substring(start, end)
  }

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim()

  return text
}

/**
 * Generic cleaner for unknown sources
 */
function cleanGenericContent(content: string): string {
  let text = decodeHtmlEntities(content)

  // Remove common navigation patterns
  text = text.replace(/\s+/g, " ").trim()

  const start = findContentStart(text)
  const end = findContentEnd(text)

  if (start < end) {
    text = text.substring(start, end).trim()
  }

  return text
}

/**
 * Source type patterns for automatic detection
 */
const SOURCE_PATTERNS: Array<{ pattern: RegExp; cleaner: (content: string) => string }> = [
  { pattern: /mirovinsko\.hr/i, cleaner: cleanHzmoContent },
  { pattern: /hzzo\.hr/i, cleaner: cleanHzzoContent },
  { pattern: /porezna-uprava\.(hr|gov\.hr)/i, cleaner: cleanPoreznaContent },
  { pattern: /fina\.hr/i, cleaner: cleanFinaContent },
  { pattern: /mfin\.gov\.hr/i, cleaner: cleanMfinContent },
  { pattern: /narodne-novine\.nn\.hr/i, cleaner: cleanNarodneNovineContent },
]

/**
 * Main entry point: clean content based on source URL
 */
export function cleanContent(content: string, sourceUrl: string): string {
  // Find matching cleaner
  for (const { pattern, cleaner } of SOURCE_PATTERNS) {
    if (pattern.test(sourceUrl)) {
      return cleaner(content)
    }
  }

  // Fallback to generic cleaner
  return cleanGenericContent(content)
}

/**
 * Extract individual news items from cleaned content
 * Returns array of { date, category, title, summary }
 */
export interface NewsItem {
  date: string | null
  category: string | null
  title: string
  summary: string | null
}

export function extractNewsItems(cleanedContent: string): NewsItem[] {
  const items: NewsItem[] = []

  // Pattern: DD.MM.YYYY or DD.MM.YYYY. followed by content until next date or end
  const datePattern = /(\d{1,2}\.\d{1,2}\.\d{4}\.?)\s+/g
  const matches = [...cleanedContent.matchAll(datePattern)]

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const nextMatch = matches[i + 1]

    const date = match[1]
    const startIdx = match.index! + match[0].length
    const endIdx = nextMatch ? nextMatch.index! : cleanedContent.length

    const itemContent = cleanedContent.substring(startIdx, endIdx).trim()

    // Try to extract category (usually after | separator)
    let category: string | null = null
    let title = itemContent
    let summary: string | null = null

    const categoryMatch = itemContent.match(/^\|?\s*([^|]+?)\s*\|/)
    if (categoryMatch) {
      category = categoryMatch[1].trim()
      title = itemContent.substring(categoryMatch[0].length).trim()
    }

    // Split title and summary (summary is usually truncated with ...)
    const summaryMatch = title.match(/^([^.!?]+[.!?])\s*(.*)/)
    if (summaryMatch && summaryMatch[2]) {
      title = summaryMatch[1].trim()
      summary = summaryMatch[2].trim() || null
    }

    items.push({ date, category, title, summary })
  }

  return items
}

/**
 * Get content cleaning statistics
 */
export function getCleaningStats(
  originalContent: string,
  cleanedContent: string
): {
  originalLength: number
  cleanedLength: number
  reductionPercent: number
  newsItemsFound: number
} {
  const newsItems = extractNewsItems(cleanedContent)

  return {
    originalLength: originalContent.length,
    cleanedLength: cleanedContent.length,
    reductionPercent: Math.round((1 - cleanedContent.length / originalContent.length) * 100),
    newsItemsFound: newsItems.length,
  }
}
