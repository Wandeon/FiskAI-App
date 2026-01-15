// src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { pingOllama, pingAllProviders, getActiveProvider } from "../llm-provider-health"

// Mock fetch
global.fetch = vi.fn()

describe("LLM Provider Health Pings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("pingOllama", () => {
    it("returns HEALTHY when /api/tags responds 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("HEALTHY")
      expect(result.reasonCode).toBe("OK")
      expect(result.provider).toBe("ollama")
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(result.checkedAt).toBeInstanceOf(Date)
    })

    it("returns CRITICAL with TIMEOUT when request times out", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"))

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("TIMEOUT")
      expect(result.provider).toBe("ollama")
      expect(result.error).toContain("timeout")
    })

    it("returns CRITICAL with TIMEOUT when request aborts", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("aborted"))

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("TIMEOUT")
    })

    it("returns CRITICAL with AUTH on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("AUTH")
      expect(result.error).toBe("HTTP 401")
    })

    it("returns CRITICAL with AUTH on 403", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("AUTH")
    })

    it("returns DEGRADED with RATE_LIMIT on 429", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("DEGRADED")
      expect(result.reasonCode).toBe("RATE_LIMIT")
    })

    it("returns CRITICAL with 5XX on 500", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("5XX")
    })

    it("returns CRITICAL with 5XX on 503", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response)

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("5XX")
    })

    it("returns CRITICAL with DNS on ENOTFOUND", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("ENOTFOUND"))

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("DNS")
    })

    it("returns CRITICAL with UNKNOWN for other errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("some unknown error"))

      const result = await pingOllama()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("UNKNOWN")
    })
  })

  describe("pingAllProviders", () => {
    it("pings ollama provider", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      } as Response)

      const results = await pingAllProviders()
      expect(results).toHaveLength(1)
      expect(results[0].provider).toBe("ollama")
    })
  })

  describe("getActiveProvider", () => {
    it("always returns ollama", () => {
      expect(getActiveProvider()).toBe("ollama")
    })
  })
})
