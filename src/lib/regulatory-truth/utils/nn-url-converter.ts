// src/lib/regulatory-truth/utils/nn-url-converter.ts
// Utility for converting between Narodne Novine URL formats

/**
 * Parse Narodne Novine article URL to extract year, issue, and article number.
 * Supports both legacy and ELI formats:
 * - Legacy: https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2519.html
 * - ELI: https://narodne-novine.nn.hr/eli/sluzbeni/2016/115/2519
 */
export function parseNNUrl(
  url: string
): { year: number; issue: number; article: number; part: string } | null {
  try {
    // Try ELI format first: /eli/{part}/{year}/{issue}/{article}
    const eliMatch = url.match(/\/eli\/([^/]+)\/(\d{4})\/(\d+)\/(\d+)/)
    if (eliMatch) {
      return {
        part: eliMatch[1],
        year: parseInt(eliMatch[2]),
        issue: parseInt(eliMatch[3]),
        article: parseInt(eliMatch[4]),
      }
    }

    // Try legacy format: /clanci/{part}/{year}_{month}_{issue}_{article}.html
    const legacyMatch = url.match(/\/clanci\/([^/]+)\/(\d{4})_\d{2}_(\d+)_(\d+)\.html/)
    if (legacyMatch) {
      return {
        part: legacyMatch[1],
        year: parseInt(legacyMatch[2]),
        issue: parseInt(legacyMatch[3]),
        article: parseInt(legacyMatch[4]),
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Convert legacy NN URL to ELI format.
 * Example:
 *   Input:  https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2519.html
 *   Output: https://narodne-novine.nn.hr/eli/sluzbeni/2016/115/2519
 */
export function convertToELI(url: string): string {
  const parsed = parseNNUrl(url)
  if (!parsed) {
    return url // Return original if parsing fails
  }

  return `https://narodne-novine.nn.hr/eli/${parsed.part}/${parsed.year}/${parsed.issue}/${parsed.article}`
}

/**
 * Convert ELI URL to legacy format (for backwards compatibility).
 * Note: This requires month information which is not in ELI format.
 * We use month=12 as a fallback since most laws are published in December.
 */
export function convertToLegacy(url: string, month: number = 12): string {
  const parsed = parseNNUrl(url)
  if (!parsed) {
    return url // Return original if parsing fails
  }

  const monthStr = month.toString().padStart(2, "0")
  return `https://narodne-novine.nn.hr/clanci/${parsed.part}/${parsed.year}_${monthStr}_${parsed.issue}_${parsed.article}.html`
}

/**
 * Check if URL is in ELI format.
 */
export function isELIFormat(url: string): boolean {
  return url.includes("/eli/")
}

/**
 * Normalize NN URL to ELI format for consistent storage.
 * This ensures all NN URLs are stored in a version-independent format.
 */
export function normalizeNNUrl(url: string): string {
  // If already in ELI format, return as-is
  if (isELIFormat(url)) {
    return url
  }

  // Convert legacy to ELI
  return convertToELI(url)
}

/**
 * Get metadata API URL for a Narodne Novine article.
 * Works with both ELI and legacy formats.
 */
export function getNNMetadataUrl(
  url: string,
  format: "json-ld" | "xml" = "json-ld"
): string | null {
  const parsed = parseNNUrl(url)
  if (!parsed) {
    return null
  }

  return `https://narodne-novine.nn.hr/article_metadata.aspx?part=${parsed.part}&year=${parsed.year}&edition_number=${parsed.issue}&article_number=${parsed.article}&format=${format}`
}
