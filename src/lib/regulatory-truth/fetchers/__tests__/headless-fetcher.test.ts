// src/lib/regulatory-truth/fetchers/__tests__/headless-fetcher.test.ts
// Unit tests for headless browser fetcher
// TDD: Write tests first, then implement

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock Playwright before importing the module
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}))

describe("headless-fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module cache to get fresh rate limiter state
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("fetchWithHeadless", () => {
    it("returns rendered HTML content from JS-heavy pages", async () => {
      // Arrange: Mock Playwright browser, context, and page
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
        content: vi
          .fn()
          .mockResolvedValue("<html><body><h1>JS-Rendered Content</h1></body></html>"),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const { chromium } = await import("playwright")
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

      // Act - use unique domain
      const { fetchWithHeadless } = await import("../headless-fetcher")
      const result = await fetchWithHeadless("https://test1.hgk.hr/novosti")

      // Assert
      expect(result.ok).toBe(true)
      expect(result.html).toContain("JS-Rendered Content")
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
      })
      expect(mockPage.goto).toHaveBeenCalledWith("https://test1.hgk.hr/novosti", {
        waitUntil: "networkidle",
        timeout: 30000,
      })
    })

    it("returns error when page navigation fails", async () => {
      // Arrange: Mock page.goto to fail
      const mockPage = {
        goto: vi.fn().mockRejectedValue(new Error("Timeout 30000ms exceeded")),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const { chromium } = await import("playwright")
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

      // Act - use unique domain
      const { fetchWithHeadless } = await import("../headless-fetcher")
      const result = await fetchWithHeadless("https://test2.hgk.hr/novosti")

      // Assert
      expect(result.ok).toBe(false)
      expect(result.error).toContain("Timeout")
    })

    it("closes browser even on error", async () => {
      // Arrange
      const mockPage = {
        goto: vi.fn().mockRejectedValue(new Error("Network error")),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const { chromium } = await import("playwright")
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

      // Act - use unique domain
      const { fetchWithHeadless } = await import("../headless-fetcher")
      await fetchWithHeadless("https://test3.hgk.hr/novosti")

      // Assert - browser should be closed
      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it("sets proper user agent", async () => {
      // Arrange
      const mockPage = {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
        content: vi.fn().mockResolvedValue("<html></html>"),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const mockBrowser = {
        newContext: vi.fn().mockResolvedValue(mockContext),
        close: vi.fn().mockResolvedValue(undefined),
      }

      const { chromium } = await import("playwright")
      vi.mocked(chromium.launch).mockResolvedValue(mockBrowser as any)

      // Act - use unique domain
      const { fetchWithHeadless } = await import("../headless-fetcher")
      await fetchWithHeadless("https://test4.hgk.hr/novosti")

      // Assert - context should be created with user agent
      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: expect.stringContaining("FiskAI"),
        })
      )
    })
  })

  describe("headless rate limiting", () => {
    it("enforces concurrency of 1 per domain", async () => {
      const { getHeadlessRateLimiter } = await import("../headless-fetcher")
      const limiter = getHeadlessRateLimiter()

      // Should have concurrency = 1
      expect(limiter.getConfig().maxConcurrentRequests).toBe(1)
    })

    it("enforces max 5 requests per minute per domain", async () => {
      const { getHeadlessRateLimiter } = await import("../headless-fetcher")
      const limiter = getHeadlessRateLimiter()

      // Should have 5 req/min = 12 seconds between requests
      expect(limiter.getConfig().requestDelayMs).toBe(12000)
    })
  })

  describe("shouldUseHeadless", () => {
    it("returns true when endpoint metadata has requiresHeadless=true", async () => {
      const { shouldUseHeadless } = await import("../headless-fetcher")

      const endpoint = {
        id: "test-1",
        domain: "hgk.hr",
        path: "/novosti",
        metadata: { requiresHeadless: true },
      }

      expect(shouldUseHeadless(endpoint)).toBe(true)
    })

    it("returns false when endpoint metadata has requiresHeadless=false", async () => {
      const { shouldUseHeadless } = await import("../headless-fetcher")

      const endpoint = {
        id: "test-2",
        domain: "porezna-uprava.gov.hr",
        path: "/vijesti",
        metadata: { requiresHeadless: false },
      }

      expect(shouldUseHeadless(endpoint)).toBe(false)
    })

    it("returns false when endpoint metadata is null", async () => {
      const { shouldUseHeadless } = await import("../headless-fetcher")

      const endpoint = {
        id: "test-3",
        domain: "hzzo.hr",
        path: "/novosti",
        metadata: null,
      }

      expect(shouldUseHeadless(endpoint)).toBe(false)
    })

    it("returns false when endpoint metadata does not have requiresHeadless", async () => {
      const { shouldUseHeadless } = await import("../headless-fetcher")

      const endpoint = {
        id: "test-4",
        domain: "fina.hr",
        path: "/novosti",
        metadata: { someOtherField: "value" },
      }

      expect(shouldUseHeadless(endpoint)).toBe(false)
    })
  })
})
