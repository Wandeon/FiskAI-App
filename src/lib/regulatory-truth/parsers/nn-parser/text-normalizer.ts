// src/lib/regulatory-truth/parsers/nn-parser/text-normalizer.ts
/**
 * Text Normalization for NN Document Anchoring
 *
 * Provides stable text normalization for matching quotes against evidence.
 * The goal is to produce a canonical form that's stable across:
 * - Unicode variations (smart quotes, dashes)
 * - Whitespace differences
 * - Croatian diacritic variations (OCR errors)
 *
 * The textNorm is used for matching, while rawText preserves the original.
 */

import {
  normalizeQuotes,
  normalizeCroatianDiacritics,
  normalizeWhitespace,
} from "../../utils/croatian-text"

/**
 * Croatian-specific character normalization.
 * Handles characters commonly found in legal texts.
 */
const CHAR_NORMALIZATIONS: [RegExp, string][] = [
  // Various dash characters → standard hyphen-minus
  [/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-"],

  // Various space characters → standard space
  [
    /[\u00A0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]/g,
    " ",
  ],

  // Ellipsis → three dots
  [/\u2026/g, "..."],

  // Various bullet points → standard bullet
  [/[\u2022\u2023\u2043\u204C\u204D\u2219]/g, "-"],

  // Croatian-specific: NN uses » « for quotes in amendments
  [/[»«]/g, '"'],

  // Numeric fractions → decimal
  [/½/g, "0.5"],
  [/⅓/g, "0.33"],
  [/⅔/g, "0.67"],
  [/¼/g, "0.25"],
  [/¾/g, "0.75"],

  // Superscript/subscript numbers → regular
  [
    /[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,
    (m) => {
      const map: Record<string, string> = {
        "⁰": "0",
        "¹": "1",
        "²": "2",
        "³": "3",
        "⁴": "4",
        "⁵": "5",
        "⁶": "6",
        "⁷": "7",
        "⁸": "8",
        "⁹": "9",
      }
      return map[m] || m
    },
  ],
  [
    /[₀₁₂₃₄₅₆₇₈₉]/g,
    (m) => {
      const map: Record<string, string> = {
        "₀": "0",
        "₁": "1",
        "₂": "2",
        "₃": "3",
        "₄": "4",
        "₅": "5",
        "₆": "6",
        "₇": "7",
        "₈": "8",
        "₉": "9",
      }
      return map[m] || m
    },
  ],
]

/**
 * HTML entity map for common entities in NN documents.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#187;": "»",
  "&#171;": "«",
  "&ldquo;": '"',
  "&rdquo;": '"',
  "&lsquo;": "'",
  "&rsquo;": "'",
  "&ndash;": "-",
  "&mdash;": "-",
  "&euro;": "EUR",
  "&copy;": "(c)",
  "&reg;": "(R)",
}

/**
 * Decode HTML entities in text.
 */
export function decodeHtmlEntities(text: string): string {
  let result = text

  // Decode named entities
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, replacement)
  }

  // Decode numeric entities (&#123; or &#x7B;)
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
  result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  )

  return result
}

/**
 * Remove HTML tags from text, preserving content.
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n") // BR tags → newlines
    .replace(/<\/p>/gi, "\n\n") // Closing P tags → double newlines
    .replace(/<\/tr>/gi, "\n") // Table row ends → newlines
    .replace(/<\/td>/gi, "\t") // Table cell ends → tabs
    .replace(/<\/th>/gi, "\t") // Table header ends → tabs
    .replace(/<[^>]+>/g, "") // Remove all other tags
}

/**
 * Apply all character normalizations.
 */
export function normalizeCharacters(text: string): string {
  let result = text
  for (const [pattern, replacement] of CHAR_NORMALIZATIONS) {
    if (typeof replacement === "string") {
      result = result.replace(pattern, replacement)
    } else {
      result = result.replace(pattern, replacement)
    }
  }
  return result
}

/**
 * Normalize paragraph markers found in NN amendments.
 * Example: »(3) Iznimno od stavka 2...« → (3) Iznimno od stavka 2...
 */
export function normalizeAmendmentMarkers(text: string): string {
  return text
    .replace(/^»+\s*/gm, "") // Leading guillemets
    .replace(/\s*«+\.?$/gm, "") // Trailing guillemets (with optional period)
    .replace(/»+/g, '"')
    .replace(/«+/g, '"')
}

/**
 * Extract and normalize stavak number from text.
 * Handles formats: (1), (2), »(3), etc.
 *
 * @returns The stavak number or null if not found
 */
export function extractStavakNumber(text: string): string | null {
  const match = text.match(/^[»"'\s]*\((\d+)\)/)
  return match ? match[1] : null
}

/**
 * Extract and normalize točka identifier from text.
 * Handles formats: 1., 2., a), b), - (dash), etc.
 *
 * @returns The točka identifier or null if not found
 */
export function extractTockaIdentifier(text: string): string | null {
  // Numbered points: 1., 2., etc.
  const numbered = text.match(/^(\d+)\.\s/)
  if (numbered) return numbered[1]

  // Lettered points: a), b), etc.
  const lettered = text.match(/^([a-z])\)\s/i)
  if (lettered) return lettered[1].toLowerCase()

  // Dashed points: - text
  if (/^[-–—]\s/.test(text)) return "-"

  return null
}

/**
 * Full text normalization for anchoring.
 *
 * Applies all normalizations to produce a stable, canonical form:
 * 1. Decode HTML entities
 * 2. Normalize Unicode characters
 * 3. Normalize quotes
 * 4. Normalize Croatian diacritics
 * 5. Collapse whitespace
 * 6. Lowercase
 *
 * @param text Raw text to normalize
 * @returns Normalized text suitable for matching
 */
export function normalizeForAnchoring(text: string): string {
  if (!text) return ""

  let result = text

  // 1. Decode HTML entities
  result = decodeHtmlEntities(result)

  // 2. Normalize Unicode characters
  result = normalizeCharacters(result)

  // 3. Normalize quotes (smart quotes → straight)
  result = normalizeQuotes(result)

  // 4. Normalize Croatian diacritics (č→c, š→s, etc.)
  result = normalizeCroatianDiacritics(result)

  // 5. Collapse whitespace
  result = normalizeWhitespace(result)

  // 6. Lowercase
  result = result.toLowerCase()

  return result
}

/**
 * Normalize text preserving structure for display.
 * Less aggressive than normalizeForAnchoring - keeps case and diacritics.
 */
export function normalizeForDisplay(text: string): string {
  if (!text) return ""

  let result = text

  // 1. Decode HTML entities
  result = decodeHtmlEntities(result)

  // 2. Normalize Unicode characters
  result = normalizeCharacters(result)

  // 3. Normalize quotes
  result = normalizeQuotes(result)

  // 4. Collapse excessive whitespace but keep single newlines
  result = result
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return result
}

/**
 * Generate a hash of normalized text for quick comparison.
 * Uses a simple but effective hash for text content.
 */
export function hashNormalizedText(text: string): string {
  const normalized = normalizeForAnchoring(text)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
