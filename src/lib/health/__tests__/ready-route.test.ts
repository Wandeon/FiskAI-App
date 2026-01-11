import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { NextResponse } from "next/server"

// Mock dependencies
const mockDbQueryRaw = vi.fn()
const mockVerifyAllFeatureContracts = vi.fn()
const mockEmitContractFailureAlert = vi.fn()
const mockLoggerError = vi.fn()

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: (...args: unknown[]) => mockDbQueryRaw(...args),
  },
}))

// Mock withApiLogging to pass through the handler function
vi.mock("@/lib/api-logging", () => ({
  withApiLogging: <T>(fn: T) => fn,
}))

// Mock logger with child support
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: vi.fn(),
    child: () => ({
      error: (...args: unknown[]) => mockLoggerError(...args),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
  },
}))

// Mock feature contracts
vi.mock("@/lib/admin/feature-contracts", () => ({
  verifyAllFeatureContracts: () => mockVerifyAllFeatureContracts(),
}))

// Mock alerting
vi.mock("@/lib/health/alerting", () => ({
  emitContractFailureAlert: (...args: unknown[]) => mockEmitContractFailureAlert(...args),
}))

// Import after mocks
import { READINESS_FAILURE_REASONS } from "../constants"

describe("health/ready route", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: (...args: any[]) => Promise<NextResponse>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    // Default: DB works, all contracts healthy
    mockDbQueryRaw.mockResolvedValue(undefined)
    mockVerifyAllFeatureContracts.mockResolvedValue({
      allHealthy: true,
      features: [],
    })
    mockEmitContractFailureAlert.mockResolvedValue(false)

    // Mock process.uptime() to return > 5 seconds (avoid initializing state)
    vi.spyOn(process, "uptime").mockReturnValue(60)

    // Re-import the route to get fresh module
    vi.resetModules()
    const routeModule = await import("@/app/api/health/ready/route")
    GET = routeModule.GET as (...args: unknown[]) => Promise<NextResponse>
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe("structured failure payload", () => {
    it("returns 200 when all checks pass", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: true,
        features: [{ name: "News Feature", enabled: true, healthy: true }],
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("ready")
      expect(data).toHaveProperty("timestamp")
      expect(data).toHaveProperty("version")
      expect(data).toHaveProperty("uptime")
      expect(data).toHaveProperty("checks")
    })

    it("returns 503 with structured payload on Type A contract failure", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: false,
        features: [
          {
            featureId: "news",
            name: "News Feature",
            enabled: true,
            healthy: false,
            missingTables: new Set(["news_posts", "news_categories"]),
          },
        ],
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("not_ready")
      expect(data.reason).toBe(READINESS_FAILURE_REASONS.MISSING_FEATURE_TABLES)
      expect(data.message).toContain("News Feature")
      expect(data.message).toContain("contract violation")
      expect(data.action).toContain("migrations")
      expect(data.failingFeatures).toEqual([
        {
          featureId: "news",
          name: "News Feature",
          missingTables: ["news_posts", "news_categories"],
        },
      ])
    })

    it("includes all required fields in failure payload", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: false,
        features: [
          {
            featureId: "news",
            name: "News",
            enabled: true,
            healthy: false,
            missingTables: new Set(["t1"]),
          },
        ],
      })

      const response = await GET()
      const data = await response.json()

      // Required fields from ReadinessFailurePayload
      expect(data).toHaveProperty("status", "not_ready")
      expect(data).toHaveProperty("reason")
      expect(data).toHaveProperty("timestamp")
      expect(data).toHaveProperty("env")
      expect(data).toHaveProperty("version")
      expect(data).toHaveProperty("uptime")
      expect(data).toHaveProperty("message")
      expect(data).toHaveProperty("action")
      expect(data).toHaveProperty("failingFeatures")

      // Validate timestamp format
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)
    })

    it("emits alert on contract failure", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: false,
        features: [
          {
            featureId: "news",
            name: "News",
            enabled: true,
            healthy: false,
            missingTables: new Set(["t1"]),
          },
        ],
      })

      await GET()

      expect(mockEmitContractFailureAlert).toHaveBeenCalledWith(
        [{ featureId: "news", name: "News", missingTables: ["t1"] }],
        expect.any(String) // version
      )
    })

    it("returns 503 on database failure", async () => {
      mockDbQueryRaw.mockRejectedValue(new Error("Connection refused"))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("not_ready")
      expect(data.reason).toBe(READINESS_FAILURE_REASONS.DATABASE_UNAVAILABLE)
      expect(data.message).toContain("Database")
    })

    it("returns 503 on database timeout (>5s)", async () => {
      // Simulate slow DB by mocking Date.now
      const originalNow = Date.now
      let callCount = 0
      vi.spyOn(Date, "now").mockImplementation(() => {
        callCount++
        // First call is dbStart, second call after query returns
        // Return 6000ms difference to simulate 6s latency
        return callCount <= 1 ? 0 : 6000
      })

      mockDbQueryRaw.mockResolvedValue(undefined)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.reason).toBe(READINESS_FAILURE_REASONS.DATABASE_UNAVAILABLE)

      Date.now = originalNow
      vi.restoreAllMocks()
    })

    it("does not emit alert on database failure (only contract failures)", async () => {
      mockDbQueryRaw.mockRejectedValue(new Error("Connection refused"))

      await GET()

      expect(mockEmitContractFailureAlert).not.toHaveBeenCalled()
    })

    it("handles multiple failing features", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: false,
        features: [
          {
            featureId: "news",
            name: "News",
            enabled: true,
            healthy: false,
            missingTables: new Set(["news_posts"]),
          },
          {
            featureId: "contentAutomation",
            name: "Content Automation",
            enabled: true,
            healthy: false,
            missingTables: new Set(["ArticleJob"]),
          },
          {
            featureId: "other",
            name: "Other",
            enabled: false,
            healthy: true, // disabled features don't count
            missingTables: new Set(),
          },
        ],
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.failingFeatures).toHaveLength(2)
      expect(data.failingFeatures[0].featureId).toBe("news")
      expect(data.failingFeatures[1].featureId).toBe("contentAutomation")
    })

    it("returns degraded status for contract verification errors", async () => {
      mockVerifyAllFeatureContracts.mockRejectedValue(new Error("Query failed"))

      const response = await GET()
      const data = await response.json()

      // Should still return 200 but with degraded featureContracts check
      expect(response.status).toBe(200)
      expect(data.checks.featureContracts.status).toBe("degraded")
      expect(data.checks.featureContracts.message).toContain("Could not verify")
    })
  })

  describe("reason codes", () => {
    it("uses database_unavailable for DB errors", async () => {
      mockDbQueryRaw.mockRejectedValue(new Error("Connection refused"))

      const response = await GET()
      const data = await response.json()

      expect(data.reason).toBe("database_unavailable")
    })

    it("uses missing_feature_tables for contract failures", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: false,
        features: [
          {
            featureId: "news",
            name: "News",
            enabled: true,
            healthy: false,
            missingTables: new Set(["t1"]),
          },
        ],
      })

      const response = await GET()
      const data = await response.json()

      expect(data.reason).toBe("missing_feature_tables")
    })
  })

  describe("action suggestions", () => {
    it("suggests migration command for missing tables", async () => {
      mockVerifyAllFeatureContracts.mockResolvedValue({
        allHealthy: false,
        features: [
          {
            featureId: "news",
            name: "News",
            enabled: true,
            healthy: false,
            missingTables: new Set(["t1"]),
          },
        ],
      })

      const response = await GET()
      const data = await response.json()

      expect(data.action).toContain("migrations")
    })

    it("suggests DB check for database failures", async () => {
      mockDbQueryRaw.mockRejectedValue(new Error("Connection refused"))

      const response = await GET()
      const data = await response.json()

      expect(data.action).toContain("database")
    })
  })
})
