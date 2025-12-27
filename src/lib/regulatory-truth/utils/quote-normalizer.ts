// src/lib/regulatory-truth/utils/quote-normalizer.ts
// Normalize Unicode quote variants to prevent verification failures from auto-correction

/**
 * Unicode quote character mappings.
 *
 * Smart quotes and other Unicode variants can be introduced by:
 * - Text editors (Word, Google Docs)
 * - PDF extraction
 * - OCR processing
 * - HTML rendering
 * - Browser copy/paste
 *
 * This causes verification failures when comparing extracted values
 * against source content because the quote characters don't match.
 */

// Double quote variants -> ASCII double quote (")
const DOUBLE_QUOTE_VARIANTS: string[] = [
  "\u201C", // " LEFT DOUBLE QUOTATION MARK
  "\u201D", // " RIGHT DOUBLE QUOTATION MARK
  "\u201E", // „ DOUBLE LOW-9 QUOTATION MARK (used in Croatian/German)
  "\u201F", // ‟ DOUBLE HIGH-REVERSED-9 QUOTATION MARK
  "\u2033", // ″ DOUBLE PRIME
  "\u2036", // ‶ REVERSED DOUBLE PRIME
  "\u00AB", // « LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
  "\u00BB", // » RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
  "\u301D", // 〝 REVERSED DOUBLE PRIME QUOTATION MARK
  "\u301E", // 〞 DOUBLE PRIME QUOTATION MARK
  "\u301F", // 〟 LOW DOUBLE PRIME QUOTATION MARK
  "\uFF02", // ＂ FULLWIDTH QUOTATION MARK
]

// Single quote variants -> ASCII single quote (')
const SINGLE_QUOTE_VARIANTS: string[] = [
  "\u2018", // ' LEFT SINGLE QUOTATION MARK
  "\u2019", // ' RIGHT SINGLE QUOTATION MARK
  "\u201A", // ‚ SINGLE LOW-9 QUOTATION MARK
  "\u201B", // ‛ SINGLE HIGH-REVERSED-9 QUOTATION MARK
  "\u2032", // ′ PRIME
  "\u2035", // ‵ REVERSED PRIME
  "\u2039", // ‹ SINGLE LEFT-POINTING ANGLE QUOTATION MARK
  "\u203A", // › SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
  "\u0060", // ` GRAVE ACCENT (backtick)
  "\u00B4", // ´ ACUTE ACCENT
  "\uFF07", // ＇ FULLWIDTH APOSTROPHE
]

// Apostrophe variants -> ASCII single quote (')
// These are semantically apostrophes but often used interchangeably with quotes
const APOSTROPHE_VARIANTS: string[] = [
  "\u02BC", // ʼ MODIFIER LETTER APOSTROPHE
  "\u02BB", // ʻ MODIFIER LETTER TURNED COMMA
  "\u02B9", // ʹ MODIFIER LETTER PRIME
  "\u02CA", // ˊ MODIFIER LETTER ACUTE ACCENT
  "\u02CB", // ˋ MODIFIER LETTER GRAVE ACCENT
]

/**
 * Normalize all quote character variants to their ASCII equivalents.
 *
 * This function:
 * - Converts smart double quotes (" ") to straight double quotes (")
 * - Converts smart single quotes (' ') to straight single quotes (')
 * - Converts other Unicode quote variants (guillemets, primes, etc.)
 * - Handles common apostrophe variants
 *
 * @param text - The text containing potentially mixed quote characters
 * @returns Text with all quotes normalized to ASCII equivalents
 *
 * @example
 * ```typescript
 * normalizeQuotes('"Hello" world') // Returns: '"Hello" world'
 * normalizeQuotes("It's a 'test'") // Returns: "It's a 'test'"
 * normalizeQuotes("«quote»")       // Returns: '"quote"'
 * ```
 */
export function normalizeQuotes(text: string): string {
  if (!text) return text

  let result = text

  // Replace double quote variants with ASCII double quote
  for (const variant of DOUBLE_QUOTE_VARIANTS) {
    result = result.replaceAll(variant, '"')
  }

  // Replace single quote variants with ASCII single quote
  for (const variant of SINGLE_QUOTE_VARIANTS) {
    result = result.replaceAll(variant, "'")
  }

  // Replace apostrophe variants with ASCII single quote
  for (const variant of APOSTROPHE_VARIANTS) {
    result = result.replaceAll(variant, "'")
  }

  return result
}

/**
 * Check if text contains any non-ASCII quote characters that need normalization.
 *
 * Useful for diagnostics and logging when tracking quote normalization issues.
 *
 * @param text - The text to check
 * @returns true if the text contains Unicode quote variants
 *
 * @example
 * ```typescript
 * hasUnicodeQuotes('"smart"') // Returns: true
 * hasUnicodeQuotes('"ascii"') // Returns: false
 * ```
 */
export function hasUnicodeQuotes(text: string): boolean {
  if (!text) return false

  const allVariants = [...DOUBLE_QUOTE_VARIANTS, ...SINGLE_QUOTE_VARIANTS, ...APOSTROPHE_VARIANTS]

  for (const variant of allVariants) {
    if (text.includes(variant)) {
      return true
    }
  }

  return false
}

/**
 * Get details about Unicode quotes found in text.
 *
 * Useful for debugging and audit logging.
 *
 * @param text - The text to analyze
 * @returns Array of found Unicode quote characters with their positions
 *
 * @example
 * ```typescript
 * findUnicodeQuotes('"test"')
 * // Returns: [
 * //   { char: '"', codePoint: 'U+201C', position: 0, name: 'LEFT DOUBLE QUOTATION MARK' },
 * //   { char: '"', codePoint: 'U+201D', position: 5, name: 'RIGHT DOUBLE QUOTATION MARK' }
 * // ]
 * ```
 */
export function findUnicodeQuotes(
  text: string
): Array<{ char: string; codePoint: string; position: number; name: string }> {
  if (!text) return []

  const results: Array<{ char: string; codePoint: string; position: number; name: string }> = []

  // Map of character to name for diagnostics
  const charNames: Record<string, string> = {
    "\u201C": "LEFT DOUBLE QUOTATION MARK",
    "\u201D": "RIGHT DOUBLE QUOTATION MARK",
    "\u201E": "DOUBLE LOW-9 QUOTATION MARK",
    "\u201F": "DOUBLE HIGH-REVERSED-9 QUOTATION MARK",
    "\u2033": "DOUBLE PRIME",
    "\u2036": "REVERSED DOUBLE PRIME",
    "\u00AB": "LEFT-POINTING DOUBLE ANGLE QUOTATION MARK",
    "\u00BB": "RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK",
    "\u301D": "REVERSED DOUBLE PRIME QUOTATION MARK",
    "\u301E": "DOUBLE PRIME QUOTATION MARK",
    "\u301F": "LOW DOUBLE PRIME QUOTATION MARK",
    "\uFF02": "FULLWIDTH QUOTATION MARK",
    "\u2018": "LEFT SINGLE QUOTATION MARK",
    "\u2019": "RIGHT SINGLE QUOTATION MARK",
    "\u201A": "SINGLE LOW-9 QUOTATION MARK",
    "\u201B": "SINGLE HIGH-REVERSED-9 QUOTATION MARK",
    "\u2032": "PRIME",
    "\u2035": "REVERSED PRIME",
    "\u2039": "SINGLE LEFT-POINTING ANGLE QUOTATION MARK",
    "\u203A": "SINGLE RIGHT-POINTING ANGLE QUOTATION MARK",
    "\u0060": "GRAVE ACCENT",
    "\u00B4": "ACUTE ACCENT",
    "\uFF07": "FULLWIDTH APOSTROPHE",
    "\u02BC": "MODIFIER LETTER APOSTROPHE",
    "\u02BB": "MODIFIER LETTER TURNED COMMA",
    "\u02B9": "MODIFIER LETTER PRIME",
    "\u02CA": "MODIFIER LETTER ACUTE ACCENT",
    "\u02CB": "MODIFIER LETTER GRAVE ACCENT",
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const name = charNames[char]
    if (name) {
      results.push({
        char,
        codePoint: `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
        position: i,
        name,
      })
    }
  }

  return results
}

/**
 * Normalize quotes in both text arguments before comparison.
 *
 * This is a convenience function for comparing text that may have
 * inconsistent quote formatting.
 *
 * @param text1 - First text to compare
 * @param text2 - Second text to compare
 * @returns Object with normalized texts
 *
 * @example
 * ```typescript
 * const { a, b } = normalizeForComparison('"smart"', '"ascii"')
 * // a === b after normalization
 * ```
 */
export function normalizeForComparison(
  text1: string,
  text2: string
): { a: string; b: string; hadUnicodeQuotes: boolean } {
  const hadUnicodeQuotes = hasUnicodeQuotes(text1) || hasUnicodeQuotes(text2)
  return {
    a: normalizeQuotes(text1),
    b: normalizeQuotes(text2),
    hadUnicodeQuotes,
  }
}
