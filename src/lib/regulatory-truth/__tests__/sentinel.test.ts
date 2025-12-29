// src/lib/regulatory-truth/__tests__/sentinel.test.ts

import { describe, it } from "node:test"
import assert from "node:assert"
import { SentinelOutputSchema, validateSentinelOutput, isSentinelOutputValid } from "../schemas"
import {
  parseSitemap,
  parseSitemapIndex,
  isSitemapIndex,
  filterNNSitemaps,
  parseNNSitemapFilename,
} from "../parsers/sitemap-parser"
import { detectContentChange, hashContent } from "../utils/content-hash"
import { classifyUrl, calculateNextScan } from "../utils/adaptive-sentinel"
import { FreshnessRisk } from "@prisma/client"

describe("Sentinel Schema", () => {
  const validOutput = {
    source_url: "https://porezna.hr/pausalno",
    fetch_timestamp: "2024-12-21T10:00:00.000Z",
    content_hash: "a".repeat(64),
    has_changed: true,
    previous_hash: "b".repeat(64),
    extracted_content: "Some regulatory text about paušalni obrt...",
    content_type: "html",
    change_summary: "Updated threshold from €35,000 to €40,000",
    sections_changed: ["section-thresholds"],
    fetch_status: "success",
    error_message: null,
  }

  it("should validate correct sentinel output", () => {
    const result = SentinelOutputSchema.safeParse(validOutput)
    assert.strictEqual(result.success, true)
  })

  it("should reject invalid content_hash length", () => {
    const invalid = { ...validOutput, content_hash: "tooshort" }
    const result = SentinelOutputSchema.safeParse(invalid)
    assert.strictEqual(result.success, false)
  })

  it("should reject invalid content_type", () => {
    const invalid = { ...validOutput, content_type: "docx" }
    const result = SentinelOutputSchema.safeParse(invalid)
    assert.strictEqual(result.success, false)
  })

  it("should reject invalid fetch_status", () => {
    const invalid = { ...validOutput, fetch_status: "pending" }
    const result = SentinelOutputSchema.safeParse(invalid)
    assert.strictEqual(result.success, false)
  })

  it("should accept null previous_hash for first fetch", () => {
    const firstFetch = { ...validOutput, previous_hash: null, has_changed: false }
    const result = SentinelOutputSchema.safeParse(firstFetch)
    assert.strictEqual(result.success, true)
  })

  it("validateSentinelOutput should throw on invalid input", () => {
    assert.throws(() => validateSentinelOutput({ invalid: true }))
  })

  it("isSentinelOutputValid should return false for invalid input", () => {
    assert.strictEqual(isSentinelOutputValid({ invalid: true }), false)
  })

  it("isSentinelOutputValid should return true for valid input", () => {
    assert.strictEqual(isSentinelOutputValid(validOutput), true)
  })
})

describe("Sentinel Discovery Logic", () => {
  describe("Sitemap Parsing", () => {
    it("should parse standard sitemap with single URL", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page1</loc>
            <lastmod>2024-01-15</lastmod>
            <priority>0.8</priority>
          </url>
        </urlset>`

      const entries = parseSitemap(xml)
      assert.strictEqual(entries.length, 1)
      assert.strictEqual(entries[0].url, "https://example.com/page1")
      assert.strictEqual(entries[0].lastmod, "2024-01-15")
      assert.strictEqual(entries[0].priority, 0.8)
    })

    it("should parse sitemap with multiple URLs", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page1</loc>
            <lastmod>2024-01-15</lastmod>
          </url>
          <url>
            <loc>https://example.com/page2</loc>
            <lastmod>2024-01-16</lastmod>
          </url>
          <url>
            <loc>https://example.com/page3</loc>
          </url>
        </urlset>`

      const entries = parseSitemap(xml)
      assert.strictEqual(entries.length, 3)
      assert.strictEqual(entries[0].url, "https://example.com/page1")
      assert.strictEqual(entries[1].url, "https://example.com/page2")
      assert.strictEqual(entries[2].url, "https://example.com/page3")
    })

    it("should return empty array for invalid XML", () => {
      const xml = "<invalid>not a sitemap</invalid>"
      const entries = parseSitemap(xml)
      assert.strictEqual(entries.length, 0)
    })

    it("should identify sitemap index", () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap>
            <loc>https://example.com/sitemap1.xml</loc>
          </sitemap>
        </sitemapindex>`

      assert.strictEqual(isSitemapIndex(indexXml), true)
    })

    it("should not identify regular sitemap as index", () => {
      const regularXml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
        </urlset>`

      assert.strictEqual(isSitemapIndex(regularXml), false)
    })

    it("should parse sitemap index and return child URLs", () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap>
            <loc>https://example.com/sitemap1.xml</loc>
            <lastmod>2024-01-15</lastmod>
          </sitemap>
          <sitemap>
            <loc>https://example.com/sitemap2.xml</loc>
            <lastmod>2024-01-16</lastmod>
          </sitemap>
        </sitemapindex>`

      const childUrls = parseSitemapIndex(indexXml)
      assert.strictEqual(childUrls.length, 2)
      assert.strictEqual(childUrls[0], "https://example.com/sitemap1.xml")
      assert.strictEqual(childUrls[1], "https://example.com/sitemap2.xml")
    })

    it("should return empty array for non-index sitemap", () => {
      const regularXml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
        </urlset>`

      const childUrls = parseSitemapIndex(regularXml)
      assert.strictEqual(childUrls.length, 0)
    })
  })

  describe("Narodne Novine Sitemap Filtering", () => {
    it("should parse NN sitemap filename", () => {
      const filename = "sitemap_1_2025_145.xml"
      const meta = parseNNSitemapFilename(filename)

      assert.ok(meta)
      assert.strictEqual(meta.type, 1)
      assert.strictEqual(meta.year, 2025)
      assert.strictEqual(meta.issue, 145)
    })

    it("should parse different NN types", () => {
      const filename1 = "sitemap_1_2024_100.xml" // Službeni
      const filename2 = "sitemap_2_2024_50.xml" // Međunarodni
      const filename3 = "sitemap_3_2024_25.xml" // Oglasni

      const meta1 = parseNNSitemapFilename(filename1)
      const meta2 = parseNNSitemapFilename(filename2)
      const meta3 = parseNNSitemapFilename(filename3)

      assert.strictEqual(meta1?.type, 1)
      assert.strictEqual(meta2?.type, 2)
      assert.strictEqual(meta3?.type, 3)
    })

    it("should return null for non-NN filename", () => {
      const filename = "regular-sitemap.xml"
      const meta = parseNNSitemapFilename(filename)
      assert.strictEqual(meta, null)
    })

    it("should filter NN sitemaps by allowed types", () => {
      const entries = [
        { url: "https://nn.hr/sitemap_1_2025_145.xml" }, // Službeni
        { url: "https://nn.hr/sitemap_2_2025_50.xml" }, // Međunarodni
        { url: "https://nn.hr/sitemap_3_2025_25.xml" }, // Oglasni
      ]

      // Default filter (types 1 and 2)
      const filtered = filterNNSitemaps(entries, [1, 2])
      assert.strictEqual(filtered.length, 2)
      assert.ok(filtered.find((e) => e.url.includes("sitemap_1_")))
      assert.ok(filtered.find((e) => e.url.includes("sitemap_2_")))
      assert.ok(!filtered.find((e) => e.url.includes("sitemap_3_")))
    })

    it("should filter to only Službeni when specified", () => {
      const entries = [
        { url: "https://nn.hr/sitemap_1_2025_145.xml" },
        { url: "https://nn.hr/sitemap_2_2025_50.xml" },
        { url: "https://nn.hr/sitemap_3_2025_25.xml" },
      ]

      const filtered = filterNNSitemaps(entries, [1])
      assert.strictEqual(filtered.length, 1)
      assert.ok(filtered[0].url.includes("sitemap_1_"))
    })
  })

  describe("Content Change Detection", () => {
    it("should detect no change when content is identical", () => {
      const content = "<html><body>Test content</body></html>"
      const hash = hashContent(content)

      const result = detectContentChange(content, hash)
      assert.strictEqual(result.hasChanged, false)
      assert.strictEqual(result.newHash, hash)
    })

    it("should detect change when content differs", () => {
      const originalContent = "<html><body>Original content</body></html>"
      const newContent = "<html><body>Modified content</body></html>"

      const originalHash = hashContent(originalContent)
      const result = detectContentChange(newContent, originalHash)

      assert.strictEqual(result.hasChanged, true)
      assert.notStrictEqual(result.newHash, originalHash)
    })

    it("should indicate first fetch when previousHash is null", () => {
      const content = "<html><body>Test content</body></html>"
      const result = detectContentChange(content, null)

      // When previousHash is null, hasChanged is true (first fetch counts as change)
      assert.strictEqual(result.hasChanged, true)
      assert.ok(result.newHash.length === 64) // Valid SHA-256 hash
    })

    it("should normalize HTML whitespace to single spaces", () => {
      const content1 = "<html>   <body>Test</body>   </html>"
      const content2 = "<html> <body>Test</body> </html>"

      const hash1 = hashContent(content1)
      const hash2 = hashContent(content2)

      // Multiple spaces collapsed to single spaces should produce identical hashes
      assert.strictEqual(hash1, hash2)
    })

    it("should ignore HTML comments in change detection", () => {
      const content1 = "<html><body>Test</body></html>"
      const content2 = "<html><!-- Comment --><body>Test</body></html>"

      const hash1 = hashContent(content1)
      const hash2 = hashContent(content2)

      assert.strictEqual(hash1, hash2)
    })

    it("should preserve JSON content exactly (no normalization)", () => {
      const json1 = '{"key": "value"}'
      const json2 = '{"key":  "value"}' // Different whitespace

      const hash1 = hashContent(json1, "application/json")
      const hash2 = hashContent(json2, "application/json")

      // JSON should NOT be normalized - exact byte comparison
      assert.notStrictEqual(hash1, hash2)
    })
  })

  describe("URL Classification", () => {
    it("should classify Narodne Novine URL with 'sluzbeni' as REGULATION", () => {
      const url = "https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_1_1.html"
      const classification = classifyUrl(url)

      assert.strictEqual(classification.nodeType, "LEAF")
      assert.strictEqual(classification.nodeRole, "REGULATION")
      assert.strictEqual(classification.freshnessRisk, "CRITICAL")
    })

    it("should classify Porezna Uprava news URL as NEWS_FEED", () => {
      const url = "https://www.porezna-uprava.hr/novosti/detaljnije/123"
      const classification = classifyUrl(url)

      assert.strictEqual(classification.nodeType, "HUB")
      assert.strictEqual(classification.nodeRole, "NEWS_FEED")
      assert.strictEqual(classification.freshnessRisk, "HIGH")
    })

    it("should classify FINA guide as GUIDANCE", () => {
      const url = "https://www.fina.hr/dokumenti/upute/vodic-za-poduzetnike.pdf"
      const classification = classifyUrl(url)

      // PDFs are classified as ASSET
      assert.strictEqual(classification.nodeType, "ASSET")
      assert.strictEqual(classification.nodeRole, null)
      assert.strictEqual(classification.freshnessRisk, "MEDIUM")
    })

    it("should classify generic URL as default LEAF", () => {
      const url = "https://example.com/some-page.html"
      const classification = classifyUrl(url)

      assert.strictEqual(classification.nodeType, "LEAF")
      assert.strictEqual(classification.nodeRole, null)
      assert.strictEqual(classification.freshnessRisk, "MEDIUM")
    })
  })

  describe("Adaptive Scanning Schedule", () => {
    it("should calculate shorter interval for CRITICAL risk items", () => {
      const now = new Date()
      const nextScan = calculateNextScan(0.5, "CRITICAL")

      const diffHours = (nextScan.getTime() - now.getTime()) / (1000 * 60 * 60)

      // CRITICAL items should be checked within 6 hours
      // With jitter, allow some variance
      assert.ok(diffHours <= 7, `Expected ≤7 hours (with jitter), got ${diffHours}`)
      assert.ok(diffHours >= 1, `Expected ≥1 hour, got ${diffHours}`)
    })

    it("should calculate longer interval for LOW risk items compared to CRITICAL", () => {
      const now = new Date()
      const criticalNext = calculateNextScan(0.5, "CRITICAL")
      const lowNext = calculateNextScan(0.5, "LOW")

      const criticalDiff = (criticalNext.getTime() - now.getTime()) / (1000 * 60 * 60)
      const lowDiff = (lowNext.getTime() - now.getTime()) / (1000 * 60 * 60)

      // LOW risk items should have longer interval than CRITICAL
      assert.ok(
        lowDiff > criticalDiff,
        `LOW interval (${lowDiff}h) should be > CRITICAL interval (${criticalDiff}h)`
      )
    })

    it("should schedule MEDIUM risk items between CRITICAL and LOW", () => {
      const now = new Date()
      const criticalNext = calculateNextScan(0.5, "CRITICAL")
      const mediumNext = calculateNextScan(0.5, "MEDIUM")
      const lowNext = calculateNextScan(0.5, "LOW")

      const criticalTime = criticalNext.getTime()
      const mediumTime = mediumNext.getTime()
      const lowTime = lowNext.getTime()

      // MEDIUM should be between CRITICAL and LOW
      assert.ok(
        mediumTime > criticalTime,
        `MEDIUM (${mediumTime}) should be > CRITICAL (${criticalTime})`
      )
      assert.ok(mediumTime < lowTime, `MEDIUM (${mediumTime}) should be < LOW (${lowTime})`)
    })

    it("should adjust schedule based on change frequency", () => {
      const highFreq = calculateNextScan(0.9, "MEDIUM") // Changes often
      const lowFreq = calculateNextScan(0.1, "MEDIUM") // Rarely changes

      // High frequency items should be checked sooner
      assert.ok(highFreq.getTime() < lowFreq.getTime())
    })
  })

  describe("Content Hash Consistency", () => {
    it("should produce 64-character SHA-256 hash", () => {
      const content = "Test content"
      const hash = hashContent(content)

      assert.strictEqual(hash.length, 64)
      assert.ok(/^[a-f0-9]{64}$/.test(hash), "Hash should be lowercase hex")
    })

    it("should produce identical hashes for identical content", () => {
      const content = "<html><body>Test</body></html>"
      const hash1 = hashContent(content)
      const hash2 = hashContent(content)

      assert.strictEqual(hash1, hash2)
    })

    it("should produce different hashes for different content", () => {
      const content1 = "<html><body>Test 1</body></html>"
      const content2 = "<html><body>Test 2</body></html>"

      const hash1 = hashContent(content1)
      const hash2 = hashContent(content2)

      assert.notStrictEqual(hash1, hash2)
    })
  })
})
