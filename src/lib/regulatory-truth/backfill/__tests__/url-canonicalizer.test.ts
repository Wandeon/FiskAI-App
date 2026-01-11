/**
 * URL Canonicalizer Tests
 *
 * Tests for URL normalization and stable hashing.
 */

import { describe, it, expect } from "vitest"
import {
  canonicalizeUrl,
  hashUrl,
  getBackfillJobId,
  extractDomain,
  urlMatchesPattern,
} from "../url-canonicalizer"

describe("canonicalizeUrl", () => {
  it("produces deterministic output for same URL", () => {
    const url = "https://example.com/page?b=2&a=1"
    const result1 = canonicalizeUrl(url)
    const result2 = canonicalizeUrl(url)
    expect(result1).toBe(result2)
  })

  it("sorts query parameters alphabetically", () => {
    const url1 = "https://example.com/page?b=2&a=1"
    const url2 = "https://example.com/page?a=1&b=2"
    expect(canonicalizeUrl(url1)).toBe(canonicalizeUrl(url2))
  })

  it("removes fragment identifiers", () => {
    const url1 = "https://example.com/page#section"
    const url2 = "https://example.com/page"
    expect(canonicalizeUrl(url1)).toBe(canonicalizeUrl(url2))
  })

  it("removes trailing slash (except root)", () => {
    const url1 = "https://example.com/page/"
    const url2 = "https://example.com/page"
    expect(canonicalizeUrl(url1)).toBe(canonicalizeUrl(url2))

    // Root path keeps trailing slash
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/")
  })

  it("lowercases protocol and hostname", () => {
    const url1 = "HTTPS://EXAMPLE.COM/Page"
    const url2 = "https://example.com/Page"
    expect(canonicalizeUrl(url1)).toBe(canonicalizeUrl(url2))
  })

  it("removes tracking parameters", () => {
    const url = "https://example.com/page?utm_source=test&utm_medium=email&real=value"
    const canonical = canonicalizeUrl(url)
    expect(canonical).not.toContain("utm_source")
    expect(canonical).not.toContain("utm_medium")
    expect(canonical).toContain("real=value")
  })

  it("removes fbclid and gclid", () => {
    const url = "https://example.com/page?fbclid=abc&gclid=xyz&id=123"
    const canonical = canonicalizeUrl(url)
    expect(canonical).not.toContain("fbclid")
    expect(canonical).not.toContain("gclid")
    expect(canonical).toContain("id=123")
  })

  it("returns invalid URLs as-is", () => {
    const invalid = "not-a-valid-url"
    expect(canonicalizeUrl(invalid)).toBe(invalid)
  })

  it("handles URLs with no query string", () => {
    const url = "https://example.com/page"
    expect(canonicalizeUrl(url)).toBe("https://example.com/page")
  })

  it("handles URLs with empty query string", () => {
    const url = "https://example.com/page?"
    const canonical = canonicalizeUrl(url)
    expect(canonical).toBe("https://example.com/page")
  })
})

describe("hashUrl", () => {
  it("produces deterministic 12-char hash", () => {
    const url = "https://example.com/page"
    const hash1 = hashUrl(url)
    const hash2 = hashUrl(url)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(12)
  })

  it("produces same hash for equivalent URLs", () => {
    const url1 = "https://example.com/page?b=2&a=1"
    const url2 = "https://example.com/page?a=1&b=2"
    expect(hashUrl(url1)).toBe(hashUrl(url2))
  })

  it("produces different hash for different URLs", () => {
    const url1 = "https://example.com/page1"
    const url2 = "https://example.com/page2"
    expect(hashUrl(url1)).not.toBe(hashUrl(url2))
  })
})

describe("getBackfillJobId", () => {
  it("produces deterministic job ID", () => {
    const sourceSlug = "narodne-novine"
    const url = "https://narodne-novine.nn.hr/clanci/123"

    const jobId1 = getBackfillJobId(sourceSlug, url)
    const jobId2 = getBackfillJobId(sourceSlug, url)

    expect(jobId1).toBe(jobId2)
  })

  it("follows expected format", () => {
    const sourceSlug = "narodne-novine"
    const url = "https://narodne-novine.nn.hr/clanci/123"

    const jobId = getBackfillJobId(sourceSlug, url)

    expect(jobId).toMatch(/^backfill:narodne-novine:[a-f0-9]{12}$/)
  })

  it("produces different IDs for different URLs", () => {
    const sourceSlug = "narodne-novine"
    const url1 = "https://narodne-novine.nn.hr/clanci/123"
    const url2 = "https://narodne-novine.nn.hr/clanci/456"

    expect(getBackfillJobId(sourceSlug, url1)).not.toBe(getBackfillJobId(sourceSlug, url2))
  })

  it("produces different IDs for different sources", () => {
    const url = "https://example.com/page"
    const id1 = getBackfillJobId("source-a", url)
    const id2 = getBackfillJobId("source-b", url)

    expect(id1).not.toBe(id2)
  })
})

describe("extractDomain", () => {
  it("extracts domain from URL", () => {
    expect(extractDomain("https://example.com/page")).toBe("example.com")
    expect(extractDomain("https://sub.example.com/page")).toBe("sub.example.com")
    expect(extractDomain("http://example.com:8080/page")).toBe("example.com")
  })

  it("returns empty string for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("")
  })
})

describe("urlMatchesPattern", () => {
  it("matches URLs against regex pattern", () => {
    const pattern = /\/clanci\/sluzbeni\/\d{4}_\d+_\d+/

    expect(
      urlMatchesPattern("https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_123.html", pattern)
    ).toBe(true)
    expect(urlMatchesPattern("https://narodne-novine.nn.hr/other/page", pattern)).toBe(false)
  })

  it("handles complex patterns", () => {
    const pattern = /\/HR\/Stranice\/(?:Vijesti|Propisi)\/[^\/]+\.aspx$/

    expect(urlMatchesPattern("https://porezna.hr/HR/Stranice/Vijesti/test.aspx", pattern)).toBe(
      true
    )
    expect(urlMatchesPattern("https://porezna.hr/HR/Stranice/Propisi/rule.aspx", pattern)).toBe(
      true
    )
    expect(urlMatchesPattern("https://porezna.hr/HR/Stranice/Other/page.aspx", pattern)).toBe(false)
  })
})
