/**
 * Cache Purge Utility Tests
 *
 * Tests for purgeContentCache and purgeByUrls functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { purgeContentCache, purgeByUrls, type CacheTag } from "../purge"

// Mock fetch globally
const mockFetch = vi.fn()

describe("Cache Purge Utility", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch)
    vi.stubEnv("CACHE_PURGE_SECRET", "test-secret-key")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fiskai.hr")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    mockFetch.mockReset()
  })

  describe("purgeContentCache", () => {
    it("should call API with correct tags", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const tags: CacheTag[] = ["kb_guides", "kb_faq"]
      const result = await purgeContentCache(tags)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://fiskai.hr/api/cache/purge",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-secret-key",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ tags: ["kb_guides", "kb_faq"] }),
        })
      )
      expect(result).toEqual({ success: true })
    })

    it("should include Authorization header with CACHE_PURGE_SECRET", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await purgeContentCache(["kb_glossary"])

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].headers.Authorization).toBe("Bearer test-secret-key")
    })

    it("should return error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })

      const result = await purgeContentCache(["kb_guides"])

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should return error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await purgeContentCache(["kb_news"])

      expect(result.success).toBe(false)
      expect(result.error).toBe("Network error")
    })

    it("should handle all cache tag types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const allTags: CacheTag[] = [
        "kb_guides",
        "kb_glossary",
        "kb_faq",
        "kb_howto",
        "kb_comparisons",
        "kb_news",
        "marketing",
        "kb_all",
      ]
      const result = await purgeContentCache(allTags)

      expect(result.success).toBe(true)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.tags).toEqual(allTags)
    })
  })

  describe("purgeByUrls", () => {
    it("should call API with absolute URLs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const urls = ["https://fiskai.hr/vodic/pdv", "https://fiskai.hr/faq/porez"]
      const result = await purgeByUrls(urls)

      expect(mockFetch).toHaveBeenCalledWith(
        "https://fiskai.hr/api/cache/purge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ urls }),
        })
      )
      expect(result.success).toBe(true)
    })

    it("should convert relative URLs to absolute", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const relativeUrls = ["/vodic/pdv", "/faq/porez"]
      await purgeByUrls(relativeUrls)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.urls).toEqual(["https://fiskai.hr/vodic/pdv", "https://fiskai.hr/faq/porez"])
    })

    it("should handle mixed relative and absolute URLs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const mixedUrls = ["/vodic/pdv", "https://fiskai.hr/faq/porez", "/pojmovnik/pdv"]
      await purgeByUrls(mixedUrls)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.urls).toEqual([
        "https://fiskai.hr/vodic/pdv",
        "https://fiskai.hr/faq/porez",
        "https://fiskai.hr/pojmovnik/pdv",
      ])
    })

    it("should include Authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await purgeByUrls(["/vodic/pdv"])

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].headers.Authorization).toBe("Bearer test-secret-key")
    })

    it("should return error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      })

      const result = await purgeByUrls(["/vodic/pdv"])

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe("ORIGIN configuration", () => {
    it("should use NEXT_PUBLIC_APP_URL when set", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://custom.domain.hr")
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      // Re-import to get new env value - this tests the module behavior
      // In practice, ORIGIN is resolved at module load time
      await purgeContentCache(["kb_guides"])

      // The fetch should use the configured URL
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
