/**
 * Sitemap Parser Tests
 *
 * Tests for XML sitemap parsing.
 */

import { describe, it, expect } from "vitest"
import { parseSitemap, filterEntriesByDate } from "../sitemap-parser"
import type { SitemapEntry } from "../types"

// Test fixture: Standard sitemap
const URLSET_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
    <lastmod>2024-02-20</lastmod>
  </url>
  <url>
    <loc>https://example.com/page3</loc>
  </url>
</urlset>`

// Test fixture: Sitemap index
const SITEMAP_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
    <lastmod>2024-01-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`

// Test fixture: Sitemap with XML entities
const SITEMAP_WITH_ENTITIES = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page?a=1&amp;b=2</loc>
  </url>
</urlset>`

describe("parseSitemap", () => {
  describe("urlset parsing", () => {
    it("parses standard urlset sitemap", () => {
      const result = parseSitemap(URLSET_SITEMAP)

      expect(result.type).toBe("urlset")
      expect(result.entries).toHaveLength(3)
    })

    it("extracts all URL fields", () => {
      const result = parseSitemap(URLSET_SITEMAP)
      const entries = result.entries as SitemapEntry[]

      expect(entries[0]).toEqual({
        loc: "https://example.com/page1",
        lastmod: "2024-01-15",
        changefreq: "daily",
        priority: "0.8",
      })
    })

    it("handles missing optional fields", () => {
      const result = parseSitemap(URLSET_SITEMAP)
      const entries = result.entries as SitemapEntry[]

      // page3 has no optional fields
      expect(entries[2]).toEqual({
        loc: "https://example.com/page3",
      })
    })

    it("decodes XML entities", () => {
      const result = parseSitemap(SITEMAP_WITH_ENTITIES)
      const entries = result.entries as SitemapEntry[]

      expect(entries[0].loc).toBe("https://example.com/page?a=1&b=2")
    })

    it("canonicalizes URLs", () => {
      const sitemap = `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page/?utm_source=test#section</loc></url>
        </urlset>`

      const result = parseSitemap(sitemap)
      const entries = result.entries as SitemapEntry[]

      // Should remove fragment and tracking params, normalize trailing slash
      expect(entries[0].loc).toBe("https://example.com/page")
    })
  })

  describe("sitemapindex parsing", () => {
    it("detects sitemap index", () => {
      const result = parseSitemap(SITEMAP_INDEX)

      expect(result.type).toBe("sitemapindex")
      expect(result.entries).toHaveLength(2)
    })

    it("extracts sitemap locations", () => {
      const result = parseSitemap(SITEMAP_INDEX)

      expect(result.entries[0].loc).toBe("https://example.com/sitemap1.xml")
      expect(result.entries[1].loc).toBe("https://example.com/sitemap2.xml")
    })

    it("extracts lastmod from sitemap index", () => {
      const result = parseSitemap(SITEMAP_INDEX)

      expect(result.entries[0].lastmod).toBe("2024-01-01")
      expect(result.entries[1].lastmod).toBeUndefined()
    })
  })

  describe("edge cases", () => {
    it("handles empty sitemap", () => {
      const empty = `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        </urlset>`

      const result = parseSitemap(empty)

      expect(result.type).toBe("urlset")
      expect(result.entries).toHaveLength(0)
    })

    it("skips invalid URLs", () => {
      const sitemap = `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/valid</loc></url>
          <url><loc>not-a-valid-url</loc></url>
          <url><loc>ftp://example.com/file</loc></url>
        </urlset>`

      const result = parseSitemap(sitemap)
      const entries = result.entries as SitemapEntry[]

      // Only HTTP/HTTPS URLs should be included
      expect(entries).toHaveLength(1)
      expect(entries[0].loc).toBe("https://example.com/valid")
    })

    it("handles malformed XML gracefully", () => {
      const malformed = `<?xml version="1.0"?>
        <urlset>
          <url><loc>https://example.com/page</loc></url>
          <url><loc>https://example.com/page2`
      // Unclosed tags

      const result = parseSitemap(malformed)

      // Should still extract what it can
      expect(result.entries).toHaveLength(1)
    })
  })
})

describe("filterEntriesByDate", () => {
  const entries: SitemapEntry[] = [
    { loc: "https://example.com/jan", lastmod: "2024-01-15" },
    { loc: "https://example.com/feb", lastmod: "2024-02-20" },
    { loc: "https://example.com/mar", lastmod: "2024-03-10" },
    { loc: "https://example.com/nodate" }, // No lastmod
  ]

  it("filters by dateFrom", () => {
    const result = filterEntriesByDate(entries, new Date("2024-02-01"))

    expect(result).toHaveLength(3) // feb, mar, nodate
    expect(result.map((e) => e.loc)).toContain("https://example.com/feb")
    expect(result.map((e) => e.loc)).toContain("https://example.com/mar")
    expect(result.map((e) => e.loc)).toContain("https://example.com/nodate")
  })

  it("filters by dateTo", () => {
    const result = filterEntriesByDate(entries, undefined, new Date("2024-02-28"))

    expect(result).toHaveLength(3) // jan, feb, nodate
    expect(result.map((e) => e.loc)).toContain("https://example.com/jan")
    expect(result.map((e) => e.loc)).toContain("https://example.com/feb")
    expect(result.map((e) => e.loc)).toContain("https://example.com/nodate")
  })

  it("filters by date range", () => {
    const result = filterEntriesByDate(entries, new Date("2024-02-01"), new Date("2024-02-28"))

    expect(result).toHaveLength(2) // feb, nodate
    expect(result.map((e) => e.loc)).toContain("https://example.com/feb")
    expect(result.map((e) => e.loc)).toContain("https://example.com/nodate")
  })

  it("returns all entries when no filter specified", () => {
    const result = filterEntriesByDate(entries)

    expect(result).toHaveLength(4)
  })

  it("keeps entries without lastmod", () => {
    const result = filterEntriesByDate(entries, new Date("2024-12-01"))

    // Only nodate should pass (others are before 2024-12-01)
    expect(result).toHaveLength(1)
    expect(result[0].loc).toBe("https://example.com/nodate")
  })
})
