/**
 * Source Backfill Config Tests
 *
 * Validates config integrity and catches domain mismatches.
 */

import { describe, it, expect } from "vitest"
import {
  SOURCE_BACKFILL_CONFIGS,
  getBackfillConfig,
  getConfiguredSourceSlugs,
  validateSourceSlugs,
  calculateDelay,
} from "../source-backfill-config"

describe("SOURCE_BACKFILL_CONFIGS", () => {
  describe("domain consistency", () => {
    it("archiveUrl host matches config domain", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        if (config.archiveUrl) {
          const urlHost = new URL(config.archiveUrl).hostname
          // Allow www. prefix in URL as long as base domain matches
          const normalizedUrlHost = urlHost.replace(/^www\./, "")
          const normalizedConfigDomain = config.domain.replace(/^www\./, "")

          expect(
            normalizedUrlHost,
            `${slug}: archiveUrl host "${urlHost}" should match domain "${config.domain}"`
          ).toBe(normalizedConfigDomain)
        }
      }
    })

    it("sitemapUrl host matches config domain", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        if (config.sitemapUrl) {
          const urlHost = new URL(config.sitemapUrl).hostname
          const normalizedUrlHost = urlHost.replace(/^www\./, "")
          const normalizedConfigDomain = config.domain.replace(/^www\./, "")

          expect(
            normalizedUrlHost,
            `${slug}: sitemapUrl host "${urlHost}" should match domain "${config.domain}"`
          ).toBe(normalizedConfigDomain)
        }
      }
    })

    it("rateLimit domain matches config domain", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        expect(
          config.rateLimit.domain,
          `${slug}: rateLimit.domain should match config domain`
        ).toBe(config.domain)
      }
    })

    it("archiveUrl must not be site root (prevents redirect-to-homepage bugs)", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        if (config.archiveUrl) {
          const url = new URL(config.archiveUrl)
          expect(
            url.pathname.length,
            `${slug}: archiveUrl "${config.archiveUrl}" must have a path (not site root)`
          ).toBeGreaterThan(1)
        }
      }
    })

    it("sitemapUrl must not be site root", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        if (config.sitemapUrl) {
          const url = new URL(config.sitemapUrl)
          expect(url.pathname.length, `${slug}: sitemapUrl must have a path`).toBeGreaterThan(1)
        }
      }
    })
  })

  describe("required fields", () => {
    it("all configs have required fields", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        expect(config.slug, `${slug}: missing slug`).toBe(slug)
        expect(config.domain, `${slug}: missing domain`).toBeTruthy()
        expect(config.mode, `${slug}: missing mode`).toBeTruthy()
        expect(config.rateLimit, `${slug}: missing rateLimit`).toBeTruthy()
        expect(config.rateLimit.minDelayMs, `${slug}: missing minDelayMs`).toBeGreaterThan(0)
        expect(config.rateLimit.maxDelayMs, `${slug}: missing maxDelayMs`).toBeGreaterThanOrEqual(
          config.rateLimit.minDelayMs
        )
      }
    })

    it("sitemap mode configs have sitemapUrl", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        if (config.mode === "SITEMAP") {
          expect(config.sitemapUrl, `${slug}: SITEMAP mode requires sitemapUrl`).toBeTruthy()
        }
      }
    })

    it("pagination mode configs have archiveUrl", () => {
      for (const [slug, config] of Object.entries(SOURCE_BACKFILL_CONFIGS)) {
        if (config.mode === "PAGINATION") {
          expect(config.archiveUrl, `${slug}: PAGINATION mode requires archiveUrl`).toBeTruthy()
        }
      }
    })
  })
})

describe("getBackfillConfig", () => {
  it("returns config for known slug", () => {
    const config = getBackfillConfig("fina")
    expect(config).toBeDefined()
    expect(config?.slug).toBe("fina")
    expect(config?.domain).toBe("fina.hr")
  })

  it("returns undefined for unknown slug", () => {
    const config = getBackfillConfig("unknown-source")
    expect(config).toBeUndefined()
  })
})

describe("getConfiguredSourceSlugs", () => {
  it("returns all configured slugs", () => {
    const slugs = getConfiguredSourceSlugs()
    expect(slugs).toContain("narodne-novine")
    expect(slugs).toContain("porezna-uprava")
    expect(slugs).toContain("hzzo")
    expect(slugs).toContain("fina")
  })
})

describe("validateSourceSlugs", () => {
  it("identifies valid slugs", () => {
    const result = validateSourceSlugs(["fina", "hzzo"])
    expect(result.valid).toEqual(["fina", "hzzo"])
    expect(result.invalid).toEqual([])
  })

  it("identifies invalid slugs", () => {
    const result = validateSourceSlugs(["fina", "unknown"])
    expect(result.valid).toEqual(["fina"])
    expect(result.invalid).toEqual(["unknown"])
  })

  it("handles empty array", () => {
    const result = validateSourceSlugs([])
    expect(result.valid).toEqual([])
    expect(result.invalid).toEqual([])
  })
})

describe("calculateDelay", () => {
  it("returns value within min/max range", () => {
    const rateLimit = { domain: "test.com", minDelayMs: 1000, maxDelayMs: 2000, maxConcurrent: 1 }

    // Run multiple times to test randomness
    for (let i = 0; i < 100; i++) {
      const delay = calculateDelay(rateLimit)
      expect(delay).toBeGreaterThanOrEqual(1000)
      expect(delay).toBeLessThanOrEqual(2000)
    }
  })

  it("returns minDelay when min equals max", () => {
    const rateLimit = { domain: "test.com", minDelayMs: 1000, maxDelayMs: 1000, maxConcurrent: 1 }
    const delay = calculateDelay(rateLimit)
    expect(delay).toBe(1000)
  })
})
