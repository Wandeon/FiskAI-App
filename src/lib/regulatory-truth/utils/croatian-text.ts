// src/lib/regulatory-truth/utils/croatian-text.ts
/**
 * Croatian Text Utilities for OCR Quote Verification
 *
 * Handles diacritic normalization, quote character normalization, and fuzzy
 * matching for Croatian text, particularly useful when verifying quotes from
 * OCR-processed documents where diacritics (c, s, z, d) may be misread or
 * lost, and smart quotes may be auto-corrected.
 *
 * Croatian diacritics:
 * - c -> c (Latin Small Letter C with Caron)
 * - c -> c (Latin Small Letter C with Acute)
 * - s -> s (Latin Small Letter S with Caron)
 * - z -> z (Latin Small Letter Z with Caron)
 * - d -> d (Latin Small Letter D with Stroke)
 *
 * Quote normalization handles:
 * - Smart double quotes (" ") -> straight quotes (")
 * - Smart single quotes (' ') -> straight quotes (')
 * - Guillemets, primes, and other Unicode quote variants
 */

import { normalizeQuotes, hasUnicodeQuotes, findUnicodeQuotes } from "./quote-normalizer"

// Re-export quote normalizer functions for convenience
export { normalizeQuotes, hasUnicodeQuotes, findUnicodeQuotes }

/**
 * Map of Croatian diacritics to their ASCII equivalents
 */
const CROATIAN_DIACRITICS: Record<string, string> = {
  // Lowercase
  "\u010D": "c", // c (c with caron)
  "\u0107": "c", // c (c with acute)
  "\u0161": "s", // s (s with caron)
  "\u017E": "z", // z (z with caron)
  "\u0111": "d", // d (d with stroke)
  // Uppercase
  "\u010C": "C", // C (C with caron)
  "\u0106": "C", // C (C with acute)
  "\u0160": "S", // S (S with caron)
  "\u017D": "Z", // Z (Z with caron)
  "\u0110": "D", // D (D with stroke)
}

/**
 * Common OCR error substitutions for Croatian text
 */
const OCR_ERROR_MAP: Record<string, string[]> = {
  // Diacritics often OCR'd as base letters
  c: ["c", "\u010D", "\u0107"],
  s: ["s", "\u0161"],
  z: ["z", "\u017E"],
  d: ["d", "\u0111"],
  // Common OCR misreads
  o: ["0", "O"],
  l: ["1", "I", "|"],
  i: ["1", "l", "|"],
  "0": ["o", "O"],
  "1": ["l", "I", "i"],
}

/**
 * Normalize Croatian diacritics to ASCII equivalents.
 *
 * @example
 * normalizeCroatianDiacritics("Racun") // "Racun"
 * normalizeCroatianDiacritics("sijecanj") // "sijecanj"
 * normalizeCroatianDiacritics("zupanija") // "zupanija"
 */
export function normalizeCroatianDiacritics(text: string): string {
  let result = text
  for (const [diacritic, replacement] of Object.entries(CROATIAN_DIACRITICS)) {
    result = result.split(diacritic).join(replacement)
  }
  return result
}

/**
 * Normalize whitespace: collapse multiple spaces, normalize newlines.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/[\t\r]/g, " ") // Convert tabs/carriage returns to spaces
    .replace(/\s+/g, " ") // Collapse multiple whitespace
    .trim()
}

/**
 * Full normalization for OCR text comparison:
 * - Normalize Unicode quote characters (smart quotes -> straight quotes)
 * - Normalize Croatian diacritics
 * - Normalize whitespace
 * - Convert to lowercase
 */
export function normalizeForComparison(text: string): string {
  return normalizeWhitespace(normalizeCroatianDiacritics(normalizeQuotes(text))).toLowerCase()
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used as the basis for similarity scoring.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i]
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[a.length][b.length]
}

/**
 * Calculate similarity ratio between two strings (0-1).
 * Uses Levenshtein distance normalized by the length of the longer string.
 *
 * @returns A value between 0 (completely different) and 1 (identical)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const maxLength = Math.max(a.length, b.length)
  const distance = levenshteinDistance(a, b)

  return 1 - distance / maxLength
}

/**
 * Calculate similarity with Croatian diacritic normalization.
 * This is more lenient for OCR errors involving diacritics.
 *
 * @returns A value between 0 (completely different) and 1 (identical after normalization)
 */
export function calculateNormalizedSimilarity(a: string, b: string): number {
  const normalizedA = normalizeForComparison(a)
  const normalizedB = normalizeForComparison(b)
  return calculateSimilarity(normalizedA, normalizedB)
}

/**
 * Check if two strings match with Croatian OCR tolerance.
 *
 * @param source The source text (from document)
 * @param target The target text (extracted quote)
 * @param threshold Minimum similarity threshold (default: 0.85 = 85%)
 * @returns Object with match result and similarity score
 */
export function fuzzyMatchCroatian(
  source: string,
  target: string,
  threshold: number = 0.85
): { matches: boolean; similarity: number; normalizedSource: string; normalizedTarget: string } {
  const normalizedSource = normalizeForComparison(source)
  const normalizedTarget = normalizeForComparison(target)

  // Exact match after normalization
  if (normalizedSource === normalizedTarget) {
    return {
      matches: true,
      similarity: 1,
      normalizedSource,
      normalizedTarget,
    }
  }

  const similarity = calculateSimilarity(normalizedSource, normalizedTarget)

  return {
    matches: similarity >= threshold,
    similarity,
    normalizedSource,
    normalizedTarget,
  }
}

/**
 * Find a substring match with Croatian OCR tolerance.
 * Useful for finding a value in a longer quote.
 *
 * @param haystack The longer text to search in
 * @param needle The text to find
 * @param threshold Minimum similarity threshold (default: 0.85)
 * @returns Object with match result, best similarity, and match position
 */
export function fuzzyContainsCroatian(
  haystack: string,
  needle: string,
  threshold: number = 0.85
): { found: boolean; similarity: number; position: number } {
  const normalizedHaystack = normalizeForComparison(haystack)
  const normalizedNeedle = normalizeForComparison(needle)

  // Exact substring match
  const exactPos = normalizedHaystack.indexOf(normalizedNeedle)
  if (exactPos !== -1) {
    return { found: true, similarity: 1, position: exactPos }
  }

  // Sliding window fuzzy match
  const needleLen = normalizedNeedle.length
  if (needleLen === 0) {
    return { found: false, similarity: 0, position: -1 }
  }

  let bestSimilarity = 0
  let bestPosition = -1

  // Check windows of similar size to the needle
  const windowSizes = [needleLen, needleLen - 1, needleLen + 1, needleLen - 2, needleLen + 2]

  for (const windowSize of windowSizes) {
    if (windowSize <= 0 || windowSize > normalizedHaystack.length) continue

    for (let i = 0; i <= normalizedHaystack.length - windowSize; i++) {
      const window = normalizedHaystack.substring(i, i + windowSize)
      const similarity = calculateSimilarity(window, normalizedNeedle)

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestPosition = i
      }

      // Early exit if we find a good enough match
      if (similarity >= threshold) {
        return { found: true, similarity, position: i }
      }
    }
  }

  return {
    found: bestSimilarity >= threshold,
    similarity: bestSimilarity,
    position: bestPosition,
  }
}

/**
 * Common Croatian month names with their normalized forms.
 * Used for date matching in OCR text.
 */
export const CROATIAN_MONTHS: Record<string, string[]> = {
  sijecanj: ["sijecanj", "sijecnja", "sijecnju"],
  veljaca: ["veljaca", "veljace", "veljaci"],
  ozujak: ["ozujak", "ozujka", "ozujku"],
  travanj: ["travanj", "travnja", "travnju"],
  svibanj: ["svibanj", "svibnja", "svibnju"],
  lipanj: ["lipanj", "lipnja", "lipnju"],
  srpanj: ["srpanj", "srpnja", "srpnju"],
  kolovoz: ["kolovoz", "kolovoza", "kolovozu"],
  rujan: ["rujan", "rujna", "rujnu"],
  listopad: ["listopad", "listopada", "listopadu"],
  studeni: ["studeni", "studenoga", "studenom"],
  prosinac: ["prosinac", "prosinca", "prosincu"],
}

/**
 * Map month number (1-12) to normalized Croatian month name patterns
 */
export function getMonthPatterns(monthNum: number): string[] {
  const monthNames = [
    "sijecanj",
    "veljaca",
    "ozujak",
    "travanj",
    "svibanj",
    "lipanj",
    "srpanj",
    "kolovoz",
    "rujan",
    "listopad",
    "studeni",
    "prosinac",
  ]

  if (monthNum < 1 || monthNum > 12) return []

  const baseName = monthNames[monthNum - 1]
  return CROATIAN_MONTHS[baseName] || [baseName]
}

/**
 * Check if a date value appears in text, handling Croatian month names
 * with OCR diacritic tolerance.
 *
 * @param isoDate ISO date string (YYYY-MM-DD)
 * @param text Text to search in
 * @param threshold Similarity threshold for fuzzy matching (default: 0.85)
 */
export function dateAppearsInText(
  isoDate: string,
  text: string,
  threshold: number = 0.85
): { found: boolean; format: string | null; similarity: number } {
  const normalizedText = normalizeForComparison(text)
  const [yearStr, monthStr, dayStr] = isoDate.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)

  // Try various date formats
  const datePatterns = [
    // ISO format
    isoDate,
    // Croatian formats
    `${day}. ${monthStr}. ${year}`,
    `${day}.${monthStr}.${year}`,
    `${day}. ${month}. ${year}`,
    `${day}.${month}.${year}`,
    // With month names
    ...getMonthPatterns(month).map((monthName) => `${day}. ${monthName} ${year}`),
    ...getMonthPatterns(month).map((monthName) => `${day} ${monthName} ${year}`),
  ]

  for (const pattern of datePatterns) {
    const normalizedPattern = normalizeForComparison(pattern)

    // Exact match
    if (normalizedText.includes(normalizedPattern)) {
      return { found: true, format: pattern, similarity: 1 }
    }

    // Fuzzy match
    const result = fuzzyContainsCroatian(text, pattern, threshold)
    if (result.found) {
      return { found: true, format: pattern, similarity: result.similarity }
    }
  }

  return { found: false, format: null, similarity: 0 }
}
