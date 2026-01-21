import * as cheerio from "cheerio"

/**
 * Clean HTML for parsing - removes scripts, styles, normalizes whitespace
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: false })

  // Remove unwanted elements
  $("script, style, noscript, iframe, object, embed").remove()

  // Remove comments
  $("*")
    .contents()
    .filter(function (this: cheerio.Element) {
      return this.type === "comment"
    })
    .remove()

  // Normalize whitespace in text nodes (but preserve structure)
  $("*")
    .contents()
    .filter(function (this: cheerio.Element) {
      return this.type === "text"
    })
    .each(function (this: cheerio.Element) {
      const text = $(this).text()
      const normalized = text.replace(/[ \t]+/g, " ")
      $(this).replaceWith(normalized)
    })

  return $.html()
}

/**
 * Extract plain text from HTML, preserving line structure
 */
export function extractText(html: string): string {
  const $ = cheerio.load(html)

  // Replace block elements with newlines
  $("p, div, br, h1, h2, h3, h4, h5, h6, li, tr").each(function (this: cheerio.Element) {
    $(this).append("\n")
  })

  // Get text and normalize
  let text = $.root().text()

  // Normalize whitespace
  text = text
    .replace(/[ \t]+/g, " ") // Multiple spaces to single
    .replace(/\n[ \t]+/g, "\n") // Trim line starts
    .replace(/[ \t]+\n/g, "\n") // Trim line ends
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .trim()

  return text
}

/**
 * Extract clean text while tracking character offsets
 * Returns the clean text and a mapping from clean positions to original HTML positions
 */
export interface TextWithOffsets {
  cleanText: string
  // Map from clean text position to original HTML position (for provenance)
  offsetMap?: Map<number, number>
}

export function extractTextWithOffsets(html: string): TextWithOffsets {
  // For v1, we don't need offset mapping - just extract clean text
  // Offset mapping can be added in v2 if needed for HTML anchor linking
  return {
    cleanText: extractText(html),
  }
}
