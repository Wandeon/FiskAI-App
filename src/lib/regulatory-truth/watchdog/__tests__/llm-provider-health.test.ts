// src/lib/regulatory-truth/watchdog/__tests__/llm-provider-health.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  pingOllama,
  pingOpenAI,
  pingDeepSeek,
  pingAllProviders,
  getActiveProvider,
  type ProviderPingResult,
} from "../llm-provider-health"

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

  describe("pingOpenAI", () => {
    const originalKey = process.env.OPENAI_API_KEY

    afterEach(() => {
      if (originalKey !== undefined) {
        process.env.OPENAI_API_KEY = originalKey
      } else {
        delete process.env.OPENAI_API_KEY
      }
    })

    it("returns CRITICAL with AUTH when no API key", async () => {
      delete process.env.OPENAI_API_KEY

      const result = await pingOpenAI()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("AUTH")
      expect(result.provider).toBe("openai")
      expect(result.error).toContain("OPENAI_API_KEY")
      expect(result.latencyMs).toBe(0)
    })

    it("returns HEALTHY when /v1/models responds 200", async () => {
      process.env.OPENAI_API_KEY = "test-key"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)

      const result = await pingOpenAI()
      expect(result.status).toBe("HEALTHY")
      expect(result.reasonCode).toBe("OK")
      expect(result.provider).toBe("openai")
    })

    it("returns CRITICAL with AUTH on 401", async () => {
      process.env.OPENAI_API_KEY = "invalid-key"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      const result = await pingOpenAI()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("AUTH")
    })

    it("returns CRITICAL with TIMEOUT on timeout error", async () => {
      process.env.OPENAI_API_KEY = "test-key"
      vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"))

      const result = await pingOpenAI()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("TIMEOUT")
    })
  })

  describe("pingDeepSeek", () => {
    const originalKey = process.env.DEEPSEEK_API_KEY

    afterEach(() => {
      if (originalKey !== undefined) {
        process.env.DEEPSEEK_API_KEY = originalKey
      } else {
        delete process.env.DEEPSEEK_API_KEY
      }
    })

    it("returns CRITICAL with AUTH when no API key", async () => {
      delete process.env.DEEPSEEK_API_KEY

      const result = await pingDeepSeek()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("AUTH")
      expect(result.provider).toBe("deepseek")
      expect(result.error).toContain("DEEPSEEK_API_KEY")
      expect(result.latencyMs).toBe(0)
    })

    it("returns HEALTHY when /v1/models responds 200", async () => {
      process.env.DEEPSEEK_API_KEY = "test-key"
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)

      const result = await pingDeepSeek()
      expect(result.status).toBe("HEALTHY")
      expect(result.reasonCode).toBe("OK")
      expect(result.provider).toBe("deepseek")
    })

    it("returns CRITICAL with TIMEOUT on timeout error", async () => {
      process.env.DEEPSEEK_API_KEY = "test-key"
      vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"))

      const result = await pingDeepSeek()
      expect(result.status).toBe("CRITICAL")
      expect(result.reasonCode).toBe("TIMEOUT")
    })
  })

  describe("pingAllProviders", () => {
    const originalOpenAI = process.env.OPENAI_API_KEY
    const originalDeepSeek = process.env.DEEPSEEK_API_KEY

    afterEach(() => {
      if (originalOpenAI !== undefined) {
        process.env.OPENAI_API_KEY = originalOpenAI
      } else {
        delete process.env.OPENAI_API_KEY
      }
      if (originalDeepSeek !== undefined) {
        process.env.DEEPSEEK_API_KEY = originalDeepSeek
      } else {
        delete process.env.DEEPSEEK_API_KEY
      }
    })

    it("pings all three providers in parallel", async () => {
      process.env.OPENAI_API_KEY = "test-key"
      process.env.DEEPSEEK_API_KEY = "test-key"

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ models: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as Response)

      const results = await pingAllProviders()
      expect(results).toHaveLength(3)
      expect(results.map((r) => r.provider).sort()).toEqual(["deepseek", "ollama", "openai"])
    })
  })

  describe("getActiveProvider", () => {
    const originalNewsAiProvider = process.env.NEWS_AI_PROVIDER
    const originalAiProvider = process.env.AI_PROVIDER
    const originalOllamaKey = process.env.OLLAMA_API_KEY
    const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY
    const originalOpenAIKey = process.env.OPENAI_API_KEY

    afterEach(() => {
      // Restore all environment variables
      if (originalNewsAiProvider !== undefined) {
        process.env.NEWS_AI_PROVIDER = originalNewsAiProvider
      } else {
        delete process.env.NEWS_AI_PROVIDER
      }
      if (originalAiProvider !== undefined) {
        process.env.AI_PROVIDER = originalAiProvider
      } else {
        delete process.env.AI_PROVIDER
      }
      if (originalOllamaKey !== undefined) {
        process.env.OLLAMA_API_KEY = originalOllamaKey
      } else {
        delete process.env.OLLAMA_API_KEY
      }
      if (originalDeepSeekKey !== undefined) {
        process.env.DEEPSEEK_API_KEY = originalDeepSeekKey
      } else {
        delete process.env.DEEPSEEK_API_KEY
      }
      if (originalOpenAIKey !== undefined) {
        process.env.OPENAI_API_KEY = originalOpenAIKey
      } else {
        delete process.env.OPENAI_API_KEY
      }
    })

    it("returns explicit NEWS_AI_PROVIDER when set", () => {
      process.env.NEWS_AI_PROVIDER = "openai"
      expect(getActiveProvider()).toBe("openai")

      process.env.NEWS_AI_PROVIDER = "deepseek"
      expect(getActiveProvider()).toBe("deepseek")

      process.env.NEWS_AI_PROVIDER = "ollama"
      expect(getActiveProvider()).toBe("ollama")
    })

    it("returns explicit AI_PROVIDER when NEWS_AI_PROVIDER not set", () => {
      delete process.env.NEWS_AI_PROVIDER
      process.env.AI_PROVIDER = "openai"
      expect(getActiveProvider()).toBe("openai")
    })

    it("infers ollama from OLLAMA_API_KEY", () => {
      delete process.env.NEWS_AI_PROVIDER
      delete process.env.AI_PROVIDER
      process.env.OLLAMA_API_KEY = "key"
      delete process.env.DEEPSEEK_API_KEY
      delete process.env.OPENAI_API_KEY
      expect(getActiveProvider()).toBe("ollama")
    })

    it("infers deepseek from DEEPSEEK_API_KEY", () => {
      delete process.env.NEWS_AI_PROVIDER
      delete process.env.AI_PROVIDER
      delete process.env.OLLAMA_API_KEY
      process.env.DEEPSEEK_API_KEY = "key"
      delete process.env.OPENAI_API_KEY
      expect(getActiveProvider()).toBe("deepseek")
    })

    it("infers openai from OPENAI_API_KEY", () => {
      delete process.env.NEWS_AI_PROVIDER
      delete process.env.AI_PROVIDER
      delete process.env.OLLAMA_API_KEY
      delete process.env.DEEPSEEK_API_KEY
      process.env.OPENAI_API_KEY = "key"
      expect(getActiveProvider()).toBe("openai")
    })

    it("defaults to ollama when nothing configured", () => {
      delete process.env.NEWS_AI_PROVIDER
      delete process.env.AI_PROVIDER
      delete process.env.OLLAMA_API_KEY
      delete process.env.DEEPSEEK_API_KEY
      delete process.env.OPENAI_API_KEY
      expect(getActiveProvider()).toBe("ollama")
    })
  })
})
