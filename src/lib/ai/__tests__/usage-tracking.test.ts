import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies before importing module
const mockCreate = vi.fn()
const mockFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    aIUsage: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Import after mocks are set up
import { trackAIUsage, getUsageStats, getUsageThisMonth } from "../usage-tracking"

describe("usage-tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: "test-id" })
  })

  describe("trackAIUsage", () => {
    it("stores durationMs when provided", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "extract_receipt",
        model: "llama3.2",
        inputTokens: 100,
        outputTokens: 50,
        success: true,
        durationMs: 1500,
        provider: "ollama",
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          durationMs: 1500,
        }),
      })
    })

    it("stores provider when provided", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "ollama_chat",
        model: "llama3.2",
        success: true,
        provider: "ollama",
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: "ollama",
        }),
      })
    })

    it("handles null durationMs (backwards compatibility)", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "extract_receipt",
        model: "llama3.2",
        success: true,
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          durationMs: null,
        }),
      })
    })

    it("handles null provider (backwards compatibility)", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "extract_receipt",
        model: "llama3.2",
        success: true,
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: null,
        }),
      })
    })

    it("stores all fields correctly for a complete record", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "ocr_receipt",
        model: "gemini-2.0-flash",
        inputTokens: 200,
        outputTokens: 100,
        success: true,
        durationMs: 2500,
        provider: "ollama",
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          companyId: "company-123",
          operation: "ocr_receipt",
          model: "gemini-2.0-flash",
          tokensUsed: 300,
          costCents: expect.any(Number),
          success: true,
          durationMs: 2500,
          provider: "ollama",
        },
      })
    })

    it("calculates cost correctly for known models", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "extract_receipt",
        model: "gemini-2.5-flash-preview-05-20",
        inputTokens: 1000000, // 1M tokens
        outputTokens: 0,
        success: true,
      })

      // gemini-2.5-flash-preview-05-20: 15 cents per 1M input tokens
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          costCents: 15,
        }),
      })
    })

    it("stores null costCents for unknown models", async () => {
      await trackAIUsage({
        companyId: "company-123",
        operation: "ollama_chat",
        model: "unknown-model-xyz",
        inputTokens: 100,
        outputTokens: 50,
        success: true,
      })

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          costCents: 0,
        }),
      })
    })

    it("does not throw when database write fails", async () => {
      mockCreate.mockRejectedValue(new Error("DB connection failed"))

      // Should not throw
      await expect(
        trackAIUsage({
          companyId: "company-123",
          operation: "extract_receipt",
          success: false,
        })
      ).resolves.toBeUndefined()
    })
  })

  describe("getUsageStats", () => {
    it("returns correct aggregations", async () => {
      const startDate = new Date("2026-01-01")
      const endDate = new Date("2026-01-31")

      mockFindMany.mockResolvedValue([
        { operation: "extract_receipt", tokensUsed: 100, costCents: 5, success: true },
        { operation: "extract_receipt", tokensUsed: 150, costCents: 8, success: true },
        { operation: "ocr_receipt", tokensUsed: 200, costCents: 20, success: false },
      ])

      const result = await getUsageStats("company-123", startDate, endDate)

      expect(result.totalCalls).toBe(3)
      expect(result.totalTokens).toBe(450)
      expect(result.totalCostCents).toBe(33)
      expect(result.successRate).toBeCloseTo(2 / 3)
      expect(result.byOperation.extract_receipt.calls).toBe(2)
      expect(result.byOperation.ocr_receipt.calls).toBe(1)
    })

    it("handles empty results", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await getUsageStats(
        "company-123",
        new Date("2026-01-01"),
        new Date("2026-01-31")
      )

      expect(result.totalCalls).toBe(0)
      expect(result.totalTokens).toBe(0)
      expect(result.totalCostCents).toBe(0)
      expect(result.successRate).toBe(0)
    })
  })

  describe("getUsageThisMonth", () => {
    it("returns correct monthly aggregations", async () => {
      mockFindMany.mockResolvedValue([
        { operation: "extract_receipt", tokensUsed: 100, costCents: 5 },
        { operation: "ollama_chat", tokensUsed: 200, costCents: 3 },
      ])

      const result = await getUsageThisMonth("company-123")

      expect(result.totalCalls).toBe(2)
      expect(result.totalTokens).toBe(300)
      expect(result.totalCostCents).toBe(8)
      expect(result.byOperation.extract_receipt.calls).toBe(1)
      expect(result.byOperation.ollama_chat.calls).toBe(1)
    })

    it("handles null token values", async () => {
      mockFindMany.mockResolvedValue([
        { operation: "ollama_chat", tokensUsed: null, costCents: null },
      ])

      const result = await getUsageThisMonth("company-123")

      expect(result.totalCalls).toBe(1)
      expect(result.totalTokens).toBe(0)
      expect(result.totalCostCents).toBe(0)
    })
  })
})
