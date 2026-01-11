/**
 * Pagination Parser Tests
 *
 * Tests for HTML pagination parsing.
 */

import { describe, it, expect } from "vitest"
import {
  buildPaginatedUrl,
  extractLinksFromHtml,
  detectNextPage,
  parsePaginationPage,
  extractDateFromUrl,
} from "../pagination-parser"

describe("buildPaginatedUrl", () => {
  it("builds URL with query page parameter", () => {
    const url = buildPaginatedUrl("https://example.com/archive", "?page={N}", 5)
    expect(url).toBe("https://example.com/archive?page=5")
  })

  it("builds URL with stranica parameter", () => {
    const url = buildPaginatedUrl("https://example.com/arhiva", "?stranica={N}", 3)
    expect(url).toBe("https://example.com/arhiva?stranica=3")
  })

  it("builds URL with path-based pagination", () => {
    const url = buildPaginatedUrl("https://example.com/news", "/page/{N}/", 2)
    expect(url).toBe("https://example.com/news/page/2/")
  })

  it("handles offset pagination", () => {
    const url = buildPaginatedUrl("https://example.com/list", "?offset={N}", 3, 20)
    // Page 3 with pageSize 20 = offset 40
    expect(url).toBe("https://example.com/list?offset=40")
  })

  it("preserves existing query parameters", () => {
    const url = buildPaginatedUrl("https://example.com/archive?filter=active", "?page={N}", 2)
    expect(url).toContain("filter=active")
    expect(url).toContain("page=2")
  })
})

describe("extractLinksFromHtml", () => {
  const baseUrl = "https://example.com/archive"

  it("extracts absolute URLs", () => {
    const html = `
      <a href="https://example.com/page1">Page 1</a>
      <a href="https://example.com/page2">Page 2</a>
    `

    const links = extractLinksFromHtml(html, baseUrl)

    expect(links).toHaveLength(2)
    expect(links).toContain("https://example.com/page1")
    expect(links).toContain("https://example.com/page2")
  })

  it("resolves relative URLs", () => {
    const html = `
      <a href="/page1">Page 1</a>
      <a href="page2">Page 2</a>
      <a href="../other">Other</a>
    `

    const links = extractLinksFromHtml(html, baseUrl)

    expect(links).toContain("https://example.com/page1")
    expect(links).toContain("https://example.com/page2")
    expect(links).toContain("https://example.com/other")
  })

  it("skips non-http links", () => {
    const html = `
      <a href="https://example.com/valid">Valid</a>
      <a href="javascript:void(0)">JS</a>
      <a href="mailto:test@example.com">Email</a>
      <a href="tel:+1234567890">Phone</a>
      <a href="#">Anchor</a>
    `

    const links = extractLinksFromHtml(html, baseUrl)

    expect(links).toHaveLength(1)
    expect(links[0]).toBe("https://example.com/valid")
  })

  it("deduplicates URLs", () => {
    const html = `
      <a href="https://example.com/page">Link 1</a>
      <a href="https://example.com/page">Link 2</a>
      <a href="https://example.com/page?utm_source=test">Link 3</a>
    `

    const links = extractLinksFromHtml(html, baseUrl)

    expect(links).toHaveLength(1)
  })

  it("filters by URL pattern", () => {
    const html = `
      <a href="https://example.com/news/article1">News 1</a>
      <a href="https://example.com/news/article2">News 2</a>
      <a href="https://example.com/about">About</a>
    `

    const pattern = /\/news\//
    const links = extractLinksFromHtml(html, baseUrl, pattern)

    expect(links).toHaveLength(2)
    expect(links.every((l) => l.includes("/news/"))).toBe(true)
  })

  it("handles single and double quotes", () => {
    const html = `
      <a href="https://example.com/double">Double</a>
      <a href='https://example.com/single'>Single</a>
    `

    const links = extractLinksFromHtml(html, baseUrl)

    expect(links).toHaveLength(2)
  })
})

describe("detectNextPage", () => {
  it("detects page=N+1 pattern", () => {
    const html = `
      <a href="?page=1">1</a>
      <a href="?page=2">2</a>
      <a href="?page=3">3</a>
    `

    expect(detectNextPage(html, 2)).toBe(true)
    // Page 3 exists but no page 4 link or "next" text
    expect(detectNextPage(html, 3)).toBe(false)
  })

  it("detects stranica=N+1 pattern", () => {
    const html = `<a href="?stranica=5">5</a>`

    expect(detectNextPage(html, 4)).toBe(true)
    // No page 6 or "next" indicator
    expect(detectNextPage(html, 5)).toBe(false)
  })

  it("detects /page/N/ pattern", () => {
    const html = `<a href="/archive/page/3/">Next</a>`

    expect(detectNextPage(html, 2)).toBe(true)
  })

  it("detects rel=next", () => {
    const html = `<link rel="next" href="?page=4">`

    expect(detectNextPage(html, 3)).toBe(true)
  })

  it("detects next text patterns", () => {
    const patterns = [
      '<a href="#">Next</a>',
      '<a href="#">Dalje</a>',
      '<a href="#">Sljedeća</a>',
      '<a href="#">→</a>',
      '<a href="#">»</a>',
    ]

    for (const html of patterns) {
      expect(detectNextPage(html, 1)).toBe(true)
    }
  })

  it("detects next class", () => {
    const html = `<a class="pagination-next" href="#">›</a>`

    expect(detectNextPage(html, 1)).toBe(true)
  })
})

describe("parsePaginationPage", () => {
  it("returns URLs and hasNextPage", () => {
    const html = `
      <a href="https://example.com/article1">Article 1</a>
      <a href="https://example.com/article2">Article 2</a>
      <a href="?page=3">3</a>
    `

    const result = parsePaginationPage(html, "https://example.com/archive", 2)

    // Returns all links including pagination link
    expect(result.urls).toHaveLength(3)
    expect(result.hasNextPage).toBe(true)
  })

  it("applies URL pattern filter", () => {
    const html = `
      <a href="https://example.com/news/a1">News 1</a>
      <a href="https://example.com/about">About</a>
    `

    const result = parsePaginationPage(html, "https://example.com/archive", 1, /\/news\//)

    expect(result.urls).toHaveLength(1)
    expect(result.urls[0]).toContain("/news/")
  })
})

describe("extractDateFromUrl", () => {
  it("extracts YYYY/MM/DD pattern", () => {
    const date = extractDateFromUrl("https://example.com/2024/01/15/article")

    expect(date).toEqual(new Date(2024, 0, 15))
  })

  it("extracts YYYY-MM-DD pattern", () => {
    const date = extractDateFromUrl("https://example.com/news/2024-02-20/")

    expect(date).toEqual(new Date(2024, 1, 20))
  })

  it("extracts date query parameter", () => {
    const date = extractDateFromUrl("https://example.com/archive?date=2024-03-10")

    expect(date).toEqual(new Date(2024, 2, 10))
  })

  it("extracts year from Narodne novine pattern", () => {
    const date = extractDateFromUrl("https://narodne-novine.nn.hr/clanci/NN-123-2024.html")

    expect(date?.getFullYear()).toBe(2024)
  })

  it("extracts year-only pattern", () => {
    const date = extractDateFromUrl("https://example.com/archive/2024/")

    expect(date?.getFullYear()).toBe(2024)
    expect(date?.getMonth()).toBe(0) // January
  })

  it("returns undefined for no date", () => {
    const date = extractDateFromUrl("https://example.com/about")

    expect(date).toBeUndefined()
  })
})
