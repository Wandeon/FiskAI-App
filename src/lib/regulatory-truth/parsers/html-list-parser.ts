// src/lib/regulatory-truth/parsers/html-list-parser.ts
import { JSDOM } from "jsdom"

export interface ListItem {
  url: string
  title: string | null
  date: string | null
}

export interface ListParserConfig {
  itemSelector: string
  linkSelector?: string
  titleSelector?: string
  dateSelector?: string
  baseUrl: string
}

// Default selectors for common Croatian government sites
const SITE_CONFIGS: Record<string, Partial<ListParserConfig>> = {
  "hzzo.hr": {
    itemSelector: "article, .news-item, .vijest, .view-content .views-row",
    linkSelector: "a",
    titleSelector: "h2, h3, .title, a",
    dateSelector: ".date, time, .field-name-field-date, .datum",
  },
  "mirovinsko.hr": {
    itemSelector: ".views-row, .news-item, article",
    linkSelector: "a",
    titleSelector: "h2, h3, .title, a",
    dateSelector: ".date, time, .field-content",
  },
  "porezna-uprava.gov.hr": {
    itemSelector: ".views-row, article, .news-list-item",
    linkSelector: "a",
    titleSelector: "h2, h3, a",
    dateSelector: ".date, time, .meta",
  },
  "fina.hr": {
    itemSelector: ".news-item, article, .list-item",
    linkSelector: "a",
    titleSelector: "h2, h3, .title",
    dateSelector: ".date, time",
  },
  "mfin.gov.hr": {
    itemSelector: ".views-row, article, .news-item",
    linkSelector: "a",
    titleSelector: "h2, h3, a",
    dateSelector: ".date, time, .meta-date",
  },
  "vlada.gov.hr": {
    itemSelector: ".news-list-item",
    linkSelector: ".news-list-item-content a",
    titleSelector: "h2",
    dateSelector: ".news-item-details .date, time",
  },
  "hanfa.hr": {
    itemSelector: ".resultItem",
    linkSelector: ".resultHolder a",
    titleSelector: ".resultTitle",
    dateSelector: ".dateSrch",
  },
}

/**
 * Parse HTML to extract list items (news, regulations, etc.)
 */
export function parseHtmlList(html: string, config: ListParserConfig): ListItem[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const items: ListItem[] = []

  const siteConfig = SITE_CONFIGS[new URL(config.baseUrl).hostname] || {}
  // Site-specific config takes precedence over caller-provided defaults
  const mergedConfig = { ...config, ...siteConfig }

  const elements = document.querySelectorAll(mergedConfig.itemSelector)

  elements.forEach((element) => {
    // Find link
    const linkElement = mergedConfig.linkSelector
      ? element.querySelector(mergedConfig.linkSelector)
      : element.querySelector("a")

    if (!linkElement) return

    const href = linkElement.getAttribute("href")
    if (!href) return

    // Resolve relative URLs
    const url = new URL(href, config.baseUrl).href

    // Skip external links
    if (!url.includes(new URL(config.baseUrl).hostname)) return

    // Skip pure anchor links but allow document URLs with anchors
    // e.g., skip "#section" but keep "/doc.pdf#page=1"
    if (href.startsWith("#")) return

    // Find title
    let title: string | null = null
    if (mergedConfig.titleSelector) {
      const titleElement = element.querySelector(mergedConfig.titleSelector)
      title = titleElement?.textContent?.trim() || null
    }
    if (!title) {
      title = linkElement.textContent?.trim() || null
    }

    // Find date
    let date: string | null = null
    if (mergedConfig.dateSelector) {
      const dateElement = element.querySelector(mergedConfig.dateSelector)
      date = dateElement?.textContent?.trim() || null
    }

    // Try to extract date from datetime attribute
    if (!date) {
      const timeElement = element.querySelector("time[datetime]")
      date = timeElement?.getAttribute("datetime") || null
    }

    items.push({ url, title, date })
  })

  // Deduplicate by URL
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

/**
 * Extract all document links from a page (PDFs, DOCs, etc.)
 * This finds documents anywhere on the page, not just in list items.
 */
export function extractDocumentLinks(html: string, baseUrl: string): ListItem[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const items: ListItem[] = []
  const seen = new Set<string>()

  const documentExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|rtf)$/i
  const hostname = new URL(baseUrl).hostname

  // Find all links on the page
  const allLinks = document.querySelectorAll("a[href]")

  allLinks.forEach((link) => {
    const href = link.getAttribute("href")
    if (!href) return

    try {
      const url = new URL(href, baseUrl).href

      // Skip external links
      if (!url.includes(hostname)) return

      // Only include document URLs
      if (!documentExtensions.test(url)) return

      // Deduplicate
      if (seen.has(url)) return
      seen.add(url)

      const title = link.textContent?.trim() || null

      items.push({ url, title, date: null })
    } catch {
      // Invalid URL
    }
  })

  return items
}

/**
 * Find pagination links in HTML.
 * Returns URLs for next pages.
 */
export function findPaginationLinks(html: string, baseUrl: string, maxPages: number = 5): string[] {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const links: string[] = []

  // Common pagination selectors
  const paginationSelectors = [
    ".pager a",
    ".pagination a",
    "nav.pager a",
    ".page-numbers a",
    "ul.pagination a",
  ]

  for (const selector of paginationSelectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => {
      const href = el.getAttribute("href")
      if (!href) return

      const url = new URL(href, baseUrl).href
      if (!links.includes(url) && url !== baseUrl) {
        links.push(url)
      }
    })
  }

  // Also check for ?page=N patterns
  const pageMatch = baseUrl.match(/[?&]page=(\d+)/)
  const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1

  if (currentPage < maxPages) {
    const nextPageUrl = baseUrl.includes("?")
      ? baseUrl.replace(/([?&])page=\d+/, `$1page=${currentPage + 1}`)
      : `${baseUrl}?page=${currentPage + 1}`

    if (!links.includes(nextPageUrl)) {
      links.push(nextPageUrl)
    }
  }

  return links.slice(0, maxPages - 1)
}
