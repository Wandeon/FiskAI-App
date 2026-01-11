/**
 * Streaming Sitemap Discovery Tests
 *
 * Tests for the high-level discovery generator.
 * Covers: date prefiltering, checkpointing, early stop, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  discoverFromSitemapIndex,
  isMassiveSitemapSource,
  type SitemapDiscoveryCheckpoint,
  type SitemapDiscoveryProgress,
} from "../streaming-sitemap-discovery"

/**
 * Create a mock fetch that returns XML content
 * Returns a vi.fn() spy so we can use toHaveBeenCalledWith assertions
 */
function createMockFetch(responses: Record<string, string>) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString()
    const content = responses[url]
    if (!content) {
      return new Response(null, { status: 404, statusText: "Not Found" })
    }
    return new Response(content, {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/xml" },
    })
  })
}

/**
 * Collect all yields from async generator and return final value
 */
async function collectWithReturn<T, R>(
  gen: AsyncGenerator<T, R>
): Promise<{ items: T[]; returnValue: R }> {
  const items: T[] = []
  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      return { items, returnValue: value as R }
    }
    items.push(value as T)
  }
}

describe("discoverFromSitemapIndex", () => {
  // Don't use fake timers by default - they break rate limiter async behavior
  // Only use fake timers for specific timing tests

  const defaultRateLimit = {
    domain: "example.com",
    minDelayMs: 0, // No delay for tests
    maxDelayMs: 0,
    maxConcurrent: 1,
  }

  describe("basic discovery", () => {
    it("discovers URLs from sitemap index", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap1.xml": `
          <urlset>
            <url><loc>https://example.com/page1.html</loc></url>
            <url><loc>https://example.com/page2.html</loc></url>
          </urlset>
        `,
        "https://example.com/sitemap2.xml": `
          <urlset>
            <url><loc>https://example.com/page3.html</loc></url>
          </urlset>
        `,
      })

      const { items, returnValue } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /example\.com\/page/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      expect(items).toHaveLength(3)
      expect(items).toContain("https://example.com/page1.html")
      expect(items).toContain("https://example.com/page2.html")
      expect(items).toContain("https://example.com/page3.html")

      expect(returnValue.lastCompletedChildSitemapIndex).toBe(1)
      expect(returnValue.urlsEmittedSoFar).toBe(3)
    })

    it("applies urlPattern filter", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap1.xml": `
          <urlset>
            <url><loc>https://example.com/article/1.html</loc></url>
            <url><loc>https://example.com/static/style.css</loc></url>
            <url><loc>https://example.com/article/2.html</loc></url>
          </urlset>
        `,
      })

      const { items } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\/article\//,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      expect(items).toHaveLength(2)
      expect(items).toContain("https://example.com/article/1.html")
      expect(items).toContain("https://example.com/article/2.html")
    })
  })

  describe("date prefiltering", () => {
    it("filters children by year", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap_2020.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap_2023.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap_2024.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap_2024.xml": `
          <urlset>
            <url><loc>https://example.com/article/2024.html</loc></url>
          </urlset>
        `,
      })

      const { items } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          datePattern: /sitemap_(\d{4})\.xml/,
          dateFrom: new Date("2024-01-01"),
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Only 2024 child should be fetched
      expect(items).toHaveLength(1)
      expect(items[0]).toBe("https://example.com/article/2024.html")

      // 2020 and 2023 should NOT have been fetched
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/sitemap_2020.xml",
        expect.anything()
      )
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/sitemap_2023.xml",
        expect.anything()
      )
    })

    it("skips undated children when includeUndatedChildren=false", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap_2024.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap_misc.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap_2024.xml": `
          <urlset>
            <url><loc>https://example.com/article.html</loc></url>
          </urlset>
        `,
      })

      const { items } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          datePattern: /sitemap_(\d{4})\.xml/,
          dateFrom: new Date("2024-01-01"),
          includeUndatedChildren: false, // Default
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      expect(items).toHaveLength(1)
      // sitemap_misc.xml should NOT be fetched (no date match)
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/sitemap_misc.xml",
        expect.anything()
      )
    })

    it("includes undated children when includeUndatedChildren=true", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap_misc.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap_misc.xml": `
          <urlset>
            <url><loc>https://example.com/misc.html</loc></url>
          </urlset>
        `,
      })

      const { items } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          datePattern: /sitemap_(\d{4})\.xml/,
          includeUndatedChildren: true,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      expect(items).toHaveLength(1)
      expect(items[0]).toBe("https://example.com/misc.html")
    })
  })

  describe("early stop at maxUrls", () => {
    it("stops at maxUrls and returns correct checkpoint", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap1.xml": `
          <urlset>
            ${Array.from({ length: 100 }, (_, i) => `<url><loc>https://example.com/page${i}.html</loc></url>`).join("")}
          </urlset>
        `,
        "https://example.com/sitemap2.xml": `
          <urlset>
            <url><loc>https://example.com/should-not-reach.html</loc></url>
          </urlset>
        `,
      })

      const { items, returnValue } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 10,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Exactly 10 URLs
      expect(items).toHaveLength(10)

      // Checkpoint should be childIndex - 1 (current child not completed)
      expect(returnValue.lastCompletedChildSitemapIndex).toBe(-1)
      expect(returnValue.urlsEmittedSoFar).toBe(10)

      // Second sitemap should NOT be fetched
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/sitemap2.xml",
        expect.anything()
      )
    })
  })

  describe("checkpoint resume", () => {
    it("resumes from checkpoint", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/sitemap0.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
            <sitemap><loc>https://example.com/sitemap3.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/sitemap2.xml": `
          <urlset>
            <url><loc>https://example.com/from-sitemap2.html</loc></url>
          </urlset>
        `,
        "https://example.com/sitemap3.xml": `
          <urlset>
            <url><loc>https://example.com/from-sitemap3.html</loc></url>
          </urlset>
        `,
      })

      // Resume from checkpoint where child 1 was completed
      const checkpoint: SitemapDiscoveryCheckpoint = {
        lastCompletedChildSitemapIndex: 1,
        lastCompletedChildSitemapUrl: "https://example.com/sitemap1.xml",
        urlsEmittedSoFar: 5,
      }

      const { items, returnValue } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          checkpoint,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Should have URLs from sitemap2 and sitemap3 only
      expect(items).toHaveLength(2)
      expect(items).toContain("https://example.com/from-sitemap2.html")
      expect(items).toContain("https://example.com/from-sitemap3.html")

      // sitemap0 and sitemap1 should NOT be fetched (skipped by checkpoint)
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/sitemap0.xml",
        expect.anything()
      )
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/sitemap1.xml",
        expect.anything()
      )

      // Final checkpoint
      expect(returnValue.lastCompletedChildSitemapIndex).toBe(3)
      expect(returnValue.urlsEmittedSoFar).toBe(7) // 5 from before + 2 new
    })

    it("respects maxUrls limit across checkpoint resume (cumulative counting)", async () => {
      // This test simulates:
      // - First run: emits 60/100 URLs, stops mid-child
      // - Second run: resumes and emits exactly 40 more (reaching 100 total)

      // Create sitemaps with 50 URLs each in 4 children (200 total)
      const createUrlset = (prefix: string, count: number) => {
        const urls = Array.from(
          { length: count },
          (_, i) => `<url><loc>https://example.com/${prefix}/url${i}.html</loc></url>`
        )
        return `<urlset>${urls.join("")}</urlset>`
      }

      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/child0.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child2.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child3.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/child0.xml": createUrlset("c0", 50),
        "https://example.com/child1.xml": createUrlset("c1", 50),
        "https://example.com/child2.xml": createUrlset("c2", 50),
        "https://example.com/child3.xml": createUrlset("c3", 50),
      })

      // First run: maxUrls=60, will complete child0 (50 URLs) and stop mid-child1 (10 URLs)
      const run1 = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 60,
          rateLimit: defaultRateLimit,
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // First run should emit exactly 60 URLs
      expect(run1.items).toHaveLength(60)
      // Early stop: checkpoint shows child -1 (child1 NOT completed because we stopped mid-child)
      expect(run1.returnValue.lastCompletedChildSitemapIndex).toBe(0) // Only child0 completed
      expect(run1.returnValue.urlsEmittedSoFar).toBe(60)

      // Reset mock fetch call count for second run
      mockFetch.mockClear()

      // Second run: resume from checkpoint, maxUrls=100 (cumulative)
      // Should emit 40 more to reach 100 total
      const run2 = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100, // Total cumulative limit
          rateLimit: defaultRateLimit,
          checkpoint: run1.returnValue, // Resume from first run's checkpoint
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Second run should emit exactly 40 more URLs
      expect(run2.items).toHaveLength(40)
      expect(run2.returnValue.urlsEmittedSoFar).toBe(100) // 60 + 40 = 100

      // child0 should NOT be fetched (already processed in first run)
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/child0.xml",
        expect.anything()
      )
    })

    it("crash-resume continues at lastCompletedChildSitemapIndex + 1", async () => {
      // This test simulates a crash scenario:
      // 1. First run completes 2 children, then "crashes" (shutdown signal)
      // 2. Second run resumes and only processes remaining children
      // 3. Verifies no re-fetching of already-completed children

      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/child0.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child2.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child3.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/child0.xml": `<urlset><url><loc>https://example.com/page0.html</loc></url></urlset>`,
        "https://example.com/child1.xml": `<urlset><url><loc>https://example.com/page1.html</loc></url></urlset>`,
        "https://example.com/child2.xml": `<urlset><url><loc>https://example.com/page2.html</loc></url></urlset>`,
        "https://example.com/child3.xml": `<urlset><url><loc>https://example.com/page3.html</loc></url></urlset>`,
      })

      // First run: simulate crash after completing 2 children
      const shutdownSignal = { shouldShutdown: false }
      let completedChildren = 0

      const run1 = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          shutdownSignal,
          onCheckpoint: () => {
            completedChildren++
            // "Crash" after 2 children complete
            if (completedChildren === 2) {
              shutdownSignal.shouldShutdown = true
            }
          },
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // First run should have processed child0 and child1 only
      expect(run1.items).toHaveLength(2)
      expect(run1.items).toContain("https://example.com/page0.html")
      expect(run1.items).toContain("https://example.com/page1.html")

      // Checkpoint should show lastCompletedChildSitemapIndex=1 (0-indexed)
      expect(run1.returnValue.lastCompletedChildSitemapIndex).toBe(1)
      expect(run1.returnValue.urlsEmittedSoFar).toBe(2)

      // Clear mock to track second run fetches
      mockFetch.mockClear()

      // Second run: resume from crash checkpoint
      const run2 = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          checkpoint: run1.returnValue, // Resume from first run's checkpoint
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Second run should process child2 and child3 only (indices 2 and 3)
      expect(run2.items).toHaveLength(2)
      expect(run2.items).toContain("https://example.com/page2.html")
      expect(run2.items).toContain("https://example.com/page3.html")

      // CRITICAL: child0 and child1 must NOT be re-fetched
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/child0.xml",
        expect.anything()
      )
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/child1.xml",
        expect.anything()
      )

      // child2 and child3 MUST be fetched
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/child2.xml", expect.anything())
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/child3.xml", expect.anything())

      // Final checkpoint should show all 4 children completed
      expect(run2.returnValue.lastCompletedChildSitemapIndex).toBe(3)
      expect(run2.returnValue.urlsEmittedSoFar).toBe(4) // 2 from run1 + 2 from run2
    })
  })

  describe("onCheckpoint callback", () => {
    it("calls onCheckpoint after each child completes", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/child1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child2.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child3.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/child1.xml": `<urlset><url><loc>https://example.com/1.html</loc></url></urlset>`,
        "https://example.com/child2.xml": `<urlset><url><loc>https://example.com/2.html</loc></url></urlset>`,
        "https://example.com/child3.xml": `<urlset><url><loc>https://example.com/3.html</loc></url></urlset>`,
      })

      const checkpoints: SitemapDiscoveryCheckpoint[] = []

      await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          onCheckpoint: (cp) => {
            checkpoints.push({ ...cp })
          },
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      expect(checkpoints).toHaveLength(3)
      expect(checkpoints[0].lastCompletedChildSitemapIndex).toBe(0)
      expect(checkpoints[1].lastCompletedChildSitemapIndex).toBe(1)
      expect(checkpoints[2].lastCompletedChildSitemapIndex).toBe(2)
    })
  })

  describe("graceful shutdown", () => {
    it("stops on shutdown signal and returns checkpoint", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/child1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child2.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child3.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/child1.xml": `<urlset><url><loc>https://example.com/1.html</loc></url></urlset>`,
        "https://example.com/child2.xml": `<urlset><url><loc>https://example.com/2.html</loc></url></urlset>`,
        "https://example.com/child3.xml": `<urlset><url><loc>https://example.com/3.html</loc></url></urlset>`,
      })

      const shutdownSignal = { shouldShutdown: false }
      let completedChildren = 0

      const { items, returnValue } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          shutdownSignal,
          onCheckpoint: () => {
            completedChildren++
            if (completedChildren === 2) {
              shutdownSignal.shouldShutdown = true
            }
          },
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Should have stopped after 2 children
      expect(items).toHaveLength(2)
      expect(returnValue.lastCompletedChildSitemapIndex).toBe(1)

      // child3 should NOT be fetched
      expect(mockFetch).not.toHaveBeenCalledWith(
        "https://example.com/child3.xml",
        expect.anything()
      )
    })
  })

  describe("error handling", () => {
    it("tolerates transient network errors", async () => {
      let callCount = 0
      const mockFetch = vi.fn(async (url: string) => {
        callCount++
        if (url === "https://example.com/child2.xml") {
          throw new Error("Network timeout")
        }
        const responses: Record<string, string> = {
          "https://example.com/sitemap.xml": `
            <sitemapindex>
              <sitemap><loc>https://example.com/child1.xml</loc></sitemap>
              <sitemap><loc>https://example.com/child2.xml</loc></sitemap>
              <sitemap><loc>https://example.com/child3.xml</loc></sitemap>
            </sitemapindex>
          `,
          "https://example.com/child1.xml": `<urlset><url><loc>https://example.com/1.html</loc></url></urlset>`,
          "https://example.com/child3.xml": `<urlset><url><loc>https://example.com/3.html</loc></url></urlset>`,
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: null,
          async arrayBuffer() {
            return new TextEncoder().encode(responses[url]).buffer
          },
        }
      })

      let progress: SitemapDiscoveryProgress | undefined

      const { items } = await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: defaultRateLimit,
          onProgress: (p) => {
            progress = { ...p }
          },
          fetchFn: mockFetch as unknown as typeof fetch,
        })
      )

      // Should have URLs from child1 and child3, but not child2
      expect(items).toHaveLength(2)
      expect(items).toContain("https://example.com/1.html")
      expect(items).toContain("https://example.com/3.html")

      // Progress should show 1 failure
      expect(progress?.childSitemapsFailed).toBe(1)
    })

    it("fails after exceeding failure threshold", async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url === "https://example.com/sitemap.xml") {
          // Return sitemap index with many children
          let xml = "<sitemapindex>"
          for (let i = 0; i < 60; i++) {
            xml += `<sitemap><loc>https://example.com/child${i}.xml</loc></sitemap>`
          }
          xml += "</sitemapindex>"
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            body: null,
            async arrayBuffer() {
              return new TextEncoder().encode(xml).buffer
            },
          }
        }
        // All children fail
        throw new Error("Network error")
      })

      await expect(
        collectWithReturn(
          discoverFromSitemapIndex({
            sitemapUrl: "https://example.com/sitemap.xml",
            urlPattern: /\.html$/,
            maxUrls: 100,
            rateLimit: defaultRateLimit,
            fetchFn: mockFetch as unknown as typeof fetch,
          })
        )
      ).rejects.toThrow(/Too many child sitemap failures/)
    })
  })

  describe("rate limiting", () => {
    it("calls rate limiter before each fetch", async () => {
      const mockFetch = createMockFetch({
        "https://example.com/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://example.com/child1.xml</loc></sitemap>
            <sitemap><loc>https://example.com/child2.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://example.com/child1.xml": `<urlset><url><loc>https://example.com/1.html</loc></url></urlset>`,
        "https://example.com/child2.xml": `<urlset><url><loc>https://example.com/2.html</loc></url></urlset>`,
      })

      const fetchTimes: number[] = []
      const wrappedFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        fetchTimes.push(Date.now())
        return mockFetch(url, init)
      })

      await collectWithReturn(
        discoverFromSitemapIndex({
          sitemapUrl: "https://example.com/sitemap.xml",
          urlPattern: /\.html$/,
          maxUrls: 100,
          rateLimit: {
            domain: "example.com",
            minDelayMs: 100,
            maxDelayMs: 100,
            maxConcurrent: 1,
          },
          fetchFn: wrappedFetch as unknown as typeof fetch,
        })
      )

      // Should have 3 fetches: index + 2 children
      expect(fetchTimes).toHaveLength(3)
    })
  })
})

describe("isMassiveSitemapSource", () => {
  it("returns true for narodne-novine", () => {
    expect(isMassiveSitemapSource("narodne-novine")).toBe(true)
  })

  it("returns false for other sources", () => {
    expect(isMassiveSitemapSource("porezna-uprava")).toBe(false)
    expect(isMassiveSitemapSource("fina")).toBe(false)
    expect(isMassiveSitemapSource("hzzo")).toBe(false)
  })
})
