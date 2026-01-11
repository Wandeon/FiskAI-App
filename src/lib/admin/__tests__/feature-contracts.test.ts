import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock functions need to be hoisted
const mockExecute = vi.fn()
const mockLoggerError = vi.fn()
const mockLoggerInfo = vi.fn()

// Mock drizzle db execute
vi.mock("@/lib/db/drizzle", () => ({
  drizzleDb: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

// Mock logger to capture CRITICAL logs
vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      error: (...args: unknown[]) => mockLoggerError(...args),
      info: (...args: unknown[]) => mockLoggerInfo(...args),
    }),
  },
}))

// Import after mocks
import {
  getFeatureStatus,
  getAllFeatureStatuses,
  verifyFeatureContract,
  verifyAllFeatureContracts,
  FEATURES,
} from "../feature-contracts"

describe("feature-contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("getFeatureStatus", () => {
    it("returns configured: true when all News tables exist", async () => {
      // Enable News as Type A
      vi.stubEnv("NEWS_TYPE_A", "true")

      // All tables exist
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const status = await getFeatureStatus("news")

      expect(status.configured).toBe(true)
      expect(status.enforced).toBe(true)
      expect(status.missingTables).toEqual([])
      expect(status.type).toBe("A")
      // Should check all required tables
      expect(mockExecute).toHaveBeenCalledTimes(FEATURES.news.requiredTables.length)
    })

    it("returns configured: false with missingTables when some tables are missing", async () => {
      vi.stubEnv("NEWS_TYPE_A", "true")

      // First two tables exist, rest don't
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // news_posts
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // news_categories
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // news_items
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // news_sources

      const status = await getFeatureStatus("news")

      expect(status.configured).toBe(false)
      expect(status.enforced).toBe(true)
      expect(status.missingTables).toEqual(["news_items", "news_sources"])
      expect(status.requiredTables).toEqual(FEATURES.news.requiredTables)
    })

    it("returns enforced: false when NEWS_TYPE_A is false", async () => {
      vi.stubEnv("NEWS_TYPE_A", "false")

      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const status = await getFeatureStatus("news")

      expect(status.enforced).toBe(false)
      // Should still check tables to know if configured
      expect(status.configured).toBe(false)
    })

    it("logs CRITICAL error in production when enforced tables are missing", async () => {
      vi.stubEnv("NODE_ENV", "production")
      // Type A defaults to enforced in production

      // All tables missing
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      await getFeatureStatus("news")

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          featureId: "news",
          severity: "CRITICAL",
          schema: "public",
        }),
        expect.stringContaining("TYPE A CONTRACT VIOLATION")
      )
    })

    it("does not log CRITICAL in development even if tables missing", async () => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("NEWS_TYPE_A", "true")

      // All tables missing
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      await getFeatureStatus("news")

      expect(mockLoggerError).not.toHaveBeenCalled()
    })

    it("returns correct status for Type B features", async () => {
      // Type B features are never enforced unless explicitly enabled
      vi.stubEnv("CONTENT_AUTOMATION_TYPE_A", "")

      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const status = await getFeatureStatus("contentAutomation")

      expect(status.type).toBe("B")
      expect(status.enforced).toBe(false)
      expect(status.configured).toBe(true)
      expect(status.requiredTables).toEqual(FEATURES.contentAutomation.requiredTables)
    })

    it("Type B can be explicitly promoted to enforced", async () => {
      vi.stubEnv("CONTENT_AUTOMATION_TYPE_A", "true")

      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const status = await getFeatureStatus("contentAutomation")

      expect(status.type).toBe("B")
      expect(status.enforced).toBe(true)
    })
  })

  describe("getAllFeatureStatuses", () => {
    it("returns allEnforcedHealthy: true when all enforced features have their tables", async () => {
      vi.stubEnv("NEWS_TYPE_A", "true")
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const { allEnforcedHealthy, allConfigured, features } = await getAllFeatureStatuses()

      expect(allEnforcedHealthy).toBe(true)
      expect(allConfigured).toBe(true)
      expect(features.length).toBe(Object.keys(FEATURES).length)
    })

    it("returns allEnforcedHealthy: false when enforced feature has missing tables", async () => {
      vi.stubEnv("NEWS_TYPE_A", "true")
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const { allEnforcedHealthy, features } = await getAllFeatureStatuses()

      expect(allEnforcedHealthy).toBe(false)
      const newsFeature = features.find((f) => f.featureId === "news")
      expect(newsFeature?.configured).toBe(false)
      expect(newsFeature?.enforced).toBe(true)
    })

    it("returns allEnforcedHealthy: true when no features are enforced", async () => {
      vi.stubEnv("NEWS_TYPE_A", "false")
      vi.stubEnv("NODE_ENV", "development")

      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const { allEnforcedHealthy, features } = await getAllFeatureStatuses()

      expect(allEnforcedHealthy).toBe(true)
      expect(features.every((f) => !f.enforced)).toBe(true)
    })
  })

  describe("backward compatibility API", () => {
    it("verifyFeatureContract maps to new API", async () => {
      vi.stubEnv("NEWS_TYPE_A", "true")
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const result = await verifyFeatureContract("news")

      expect(result.enabled).toBe(true) // maps to enforced
      expect(result.healthy).toBe(true) // maps to configured
      expect(result.missingTables).toEqual([])
    })

    it("verifyAllFeatureContracts maps to new API", async () => {
      vi.stubEnv("NEWS_TYPE_A", "true")
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const { allHealthy, features } = await verifyAllFeatureContracts()

      expect(allHealthy).toBe(true)
      expect(features.length).toBeGreaterThan(0)
      expect(features[0]).toHaveProperty("enabled")
      expect(features[0]).toHaveProperty("healthy")
    })
  })

  describe("Type A default behavior", () => {
    it("defaults to enforced in production when env flag not set", async () => {
      vi.stubEnv("NODE_ENV", "production")
      vi.stubEnv("NEWS_TYPE_A", "")

      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const status = await getFeatureStatus("news")

      expect(status.enforced).toBe(true)
    })

    it("defaults to not enforced in development when env flag not set", async () => {
      vi.stubEnv("NODE_ENV", "development")
      vi.stubEnv("NEWS_TYPE_A", "")

      const status = await getFeatureStatus("news")

      expect(status.enforced).toBe(false)
    })
  })

  describe("FEATURES registry", () => {
    it("has News as Type A feature", () => {
      expect(FEATURES.news.type).toBe("A")
      expect(FEATURES.news.requiredTables).toContain("news_posts")
      expect(FEATURES.news.requiredTables).toContain("news_categories")
    })

    it("has Content Automation as Type B feature", () => {
      expect(FEATURES.contentAutomation.type).toBe("B")
      expect(FEATURES.contentAutomation.requiredTables).toContain("ArticleJob")
      expect(FEATURES.contentAutomation.requiredTables).toContain("content_sync_events")
    })

    it("is the single source of truth for table names", () => {
      // Verify no hardcoded table lists - just checking structure
      for (const [, feature] of Object.entries(FEATURES)) {
        expect(Array.isArray(feature.requiredTables)).toBe(true)
        expect(feature.requiredTables.length).toBeGreaterThan(0)
        expect(typeof feature.name).toBe("string")
        expect(typeof feature.envFlag).toBe("string")
        expect(["A", "B"]).toContain(feature.type)
      }
    })
  })
})
