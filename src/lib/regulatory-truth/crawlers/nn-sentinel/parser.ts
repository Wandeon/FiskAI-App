// src/lib/regulatory-truth/crawlers/nn-sentinel/parser.ts
/**
 * HTML Parsing for NN Pages
 *
 * Extracts issue and item links from Narodne Novine listing pages.
 * All results are sorted deterministically by numeric key.
 */

// =============================================================================
// Types
// =============================================================================

export interface DiscoveredIssue {
  issueNumber: number
  issueUrl: string
  month?: number
}

export interface DiscoveredItem {
  itemNumber: number
  itemUrl: string
  title?: string
  textType?: "CONSOLIDATED" | "AMENDMENT" | "UNKNOWN"
}

// =============================================================================
// Constants
// =============================================================================

const NN_BASE_URL = "https://narodne-novine.nn.hr"
const NN_SLUZBENI_BASE = `${NN_BASE_URL}/clanci/sluzbeni`

// =============================================================================
// Year Page Parser
// =============================================================================

/**
 * Parse year page HTML to extract issue links.
 * Returns issues sorted by issue number ascending (deterministic ordering).
 */
export function parseYearPage(html: string, year: number): DiscoveredIssue[] {
  const issues: DiscoveredIssue[] = []

  // Pattern: links to issue pages like /clanci/sluzbeni/2024/152
  // or /clanci/sluzbeni/2024_12_152.html (older format)
  const linkPattern =
    /href="([^"]*\/clanci\/sluzbeni\/\d{4}[/_](?:\d{2}_)?(\d+)(?:\.html)?)"[^>]*>([^<]*)</gi

  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const [, url, issueStr] = match
    const issueNumber = parseInt(issueStr, 10)

    if (!isNaN(issueNumber) && issueNumber > 0) {
      // Normalize URL
      const normalizedUrl = url.startsWith("http") ? url : `${NN_BASE_URL}${url}`

      // Avoid duplicates
      if (!issues.some((i) => i.issueNumber === issueNumber)) {
        issues.push({
          issueNumber,
          issueUrl: normalizedUrl,
        })
      }
    }
  }

  // Also try simpler pattern for newer site structure
  const simplePattern = /href="[^"]*\/(\d+)"[^>]*>\s*(?:Br\.|Broj|NN)?\s*(\d+)/gi
  while ((match = simplePattern.exec(html)) !== null) {
    const issueNumber = parseInt(match[2] || match[1], 10)

    if (!isNaN(issueNumber) && issueNumber > 0) {
      const issueUrl = `${NN_SLUZBENI_BASE}/${year}/${issueNumber}`

      if (!issues.some((i) => i.issueNumber === issueNumber)) {
        issues.push({
          issueNumber,
          issueUrl,
        })
      }
    }
  }

  // Sort by issue number ascending (deterministic ordering)
  return issues.sort((a, b) => a.issueNumber - b.issueNumber)
}

// =============================================================================
// Issue Page Parser
// =============================================================================

/**
 * Parse issue page HTML to extract item links.
 * Returns items sorted by item number ascending (deterministic ordering).
 */
export function parseIssuePage(html: string, year: number, issue: number): DiscoveredItem[] {
  const items: DiscoveredItem[] = []

  // Pattern: links to item pages like /clanci/sluzbeni/2024_12_152_2505.html
  // or /eli/sluzbeni/2024/152/2505
  const itemPattern =
    /href="([^"]*(?:\/clanci\/sluzbeni\/\d{4}_\d{2}_\d+_(\d+)\.html|\/eli\/sluzbeni\/\d{4}\/\d+\/(\d+)))"[^>]*>([^<]*)</gi

  let match
  while ((match = itemPattern.exec(html)) !== null) {
    const [, url, itemStr1, itemStr2, title] = match
    const itemNumber = parseInt(itemStr1 || itemStr2, 10)

    if (!isNaN(itemNumber) && itemNumber > 0) {
      // Normalize URL
      const normalizedUrl = url.startsWith("http") ? url : `${NN_BASE_URL}${url}`

      // Validate URL contains expected year/issue
      const urlYearMatch = normalizedUrl.match(/\/(\d{4})[_/]/)
      const urlIssueMatch = normalizedUrl.match(/_(\d+)_\d+\.html|\/(\d+)\/\d+$/)
      const urlYear = urlYearMatch ? parseInt(urlYearMatch[1], 10) : year
      const urlIssue = urlIssueMatch ? parseInt(urlIssueMatch[1] || urlIssueMatch[2], 10) : issue

      // Only include items from the expected year/issue
      if (urlYear !== year || (urlIssue !== issue && urlIssue !== 0)) {
        continue
      }

      // Detect text type from title/context
      const textType = detectTextType(title || "")

      if (!items.some((i) => i.itemNumber === itemNumber)) {
        items.push({
          itemNumber,
          itemUrl: normalizedUrl,
          title: title?.trim() || undefined,
          textType,
        })
      }
    }
  }

  // Simpler pattern for direct item links
  const simpleItemPattern = /href="([^"]*_(\d+)\.html)"[^>]*>([^<]*)</gi
  while ((match = simpleItemPattern.exec(html)) !== null) {
    const [, url, itemStr, title] = match
    const itemNumber = parseInt(itemStr, 10)

    if (!isNaN(itemNumber) && itemNumber > 0 && !items.some((i) => i.itemNumber === itemNumber)) {
      const normalizedUrl = url.startsWith("http") ? url : `${NN_BASE_URL}${url}`

      // Validate URL contains expected year
      if (!normalizedUrl.includes(String(year))) {
        continue
      }

      items.push({
        itemNumber,
        itemUrl: normalizedUrl,
        title: title?.trim() || undefined,
        textType: detectTextType(title || ""),
      })
    }
  }

  // Sort by item number ascending (deterministic ordering)
  return items.sort((a, b) => a.itemNumber - b.itemNumber)
}

// =============================================================================
// Text Type Detection
// =============================================================================

/**
 * Detect text type from title.
 * - CONSOLIDATED: pročišćeni tekst (official consolidated version)
 * - AMENDMENT: izmjene, dopune, ispravak (changes to existing law)
 * - UNKNOWN: can't determine
 */
function detectTextType(title: string): "CONSOLIDATED" | "AMENDMENT" | "UNKNOWN" {
  const lowerTitle = title.toLowerCase()

  if (lowerTitle.includes("pročišćeni") || lowerTitle.includes("procisceni")) {
    return "CONSOLIDATED"
  }

  if (
    lowerTitle.includes("izmjen") ||
    lowerTitle.includes("dopun") ||
    lowerTitle.includes("ispravak")
  ) {
    return "AMENDMENT"
  }

  return "UNKNOWN"
}
