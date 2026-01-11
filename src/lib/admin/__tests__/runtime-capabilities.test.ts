import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock functions need to be hoisted
const mockExecute = vi.fn()
const mockLoggerError = vi.fn()
const mockLoggerInfo = vi.fn()

// Mock drizzle db execute (used by feature-contracts.ts)
vi.mock("@/lib/db/drizzle", () => ({
  drizzleDb: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

// Mock logger (used by feature-contracts.ts)
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
  hasNewsTables,
  hasRegulatoryTruthTables,
  hasFeatureTables,
  NEWS_TABLES,
  CONTENT_AUTOMATION_TABLES,
} from "../runtime-capabilities"
import { FEATURES } from "../feature-contracts"

describe("runtime-capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("hasNewsTables", () => {
    it("returns available: true when all news tables exist", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const result = await hasNewsTables()

      expect(result.available).toBe(true)
      expect(result.missingTables).toEqual([])
      // Should check all tables from FEATURES registry
      expect(mockExecute).toHaveBeenCalledTimes(FEATURES.news.requiredTables.length)
    })

    it("returns available: false with missing tables when some are missing", async () => {
      // First two tables exist, rest don't
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // news_posts
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // news_categories
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // news_items
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // news_sources

      const result = await hasNewsTables()

      expect(result.available).toBe(false)
      expect(result.missingTables).toEqual(["news_items", "news_sources"])
    })

    it("returns all missing tables when none exist", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const result = await hasNewsTables()

      expect(result.available).toBe(false)
      expect(result.missingTables).toEqual([...FEATURES.news.requiredTables])
    })

    it("returns requiredTables from FEATURES registry", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const result = await hasNewsTables()

      expect(result.requiredTables).toEqual(FEATURES.news.requiredTables)
    })
  })

  describe("hasRegulatoryTruthTables", () => {
    it("returns available: true when all content automation tables exist", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const result = await hasRegulatoryTruthTables()

      expect(result.available).toBe(true)
      expect(result.missingTables).toEqual([])
      // Should check all tables from FEATURES registry
      expect(mockExecute).toHaveBeenCalledTimes(FEATURES.contentAutomation.requiredTables.length)
    })

    it("returns available: false with missing tables when ArticleJob is missing", async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // ArticleJob
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // content_sync_events

      const result = await hasRegulatoryTruthTables()

      expect(result.available).toBe(false)
      expect(result.missingTables).toEqual(["ArticleJob"])
    })

    it("returns available: false with missing tables when content_sync_events is missing", async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // ArticleJob
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // content_sync_events

      const result = await hasRegulatoryTruthTables()

      expect(result.available).toBe(false)
      expect(result.missingTables).toEqual(["content_sync_events"])
    })

    it("returns all missing tables when none exist", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const result = await hasRegulatoryTruthTables()

      expect(result.available).toBe(false)
      expect(result.missingTables).toEqual([...FEATURES.contentAutomation.requiredTables])
    })

    it("returns requiredTables from FEATURES registry", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const result = await hasRegulatoryTruthTables()

      expect(result.requiredTables).toEqual(FEATURES.contentAutomation.requiredTables)
    })
  })

  describe("hasFeatureTables (generic)", () => {
    it("delegates to getFeatureStatus for any feature", async () => {
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const newsResult = await hasFeatureTables("news")
      expect(newsResult.available).toBe(true)
      expect(newsResult.requiredTables).toEqual(FEATURES.news.requiredTables)

      vi.clearAllMocks()
      mockExecute.mockResolvedValue({ rows: [{ exists: true }] })

      const contentResult = await hasFeatureTables("contentAutomation")
      expect(contentResult.available).toBe(true)
      expect(contentResult.requiredTables).toEqual(FEATURES.contentAutomation.requiredTables)
    })
  })

  describe("deprecated constants", () => {
    it("NEWS_TABLES matches FEATURES.news.requiredTables", () => {
      expect(NEWS_TABLES).toEqual(FEATURES.news.requiredTables)
    })

    it("CONTENT_AUTOMATION_TABLES matches FEATURES.contentAutomation.requiredTables", () => {
      expect(CONTENT_AUTOMATION_TABLES).toEqual(FEATURES.contentAutomation.requiredTables)
    })
  })

  describe("single source of truth invariant", () => {
    it("hasNewsTables uses the same table list as FEATURES registry", async () => {
      // Mock all tables as missing
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const result = await hasNewsTables()

      // The missing tables should exactly match the FEATURES registry
      expect(result.missingTables).toHaveLength(FEATURES.news.requiredTables.length)
      for (const table of FEATURES.news.requiredTables) {
        expect(result.missingTables).toContain(table)
      }
    })

    it("hasRegulatoryTruthTables uses the same table list as FEATURES registry", async () => {
      // Mock all tables as missing
      mockExecute.mockResolvedValue({ rows: [{ exists: false }] })

      const result = await hasRegulatoryTruthTables()

      // The missing tables should exactly match the FEATURES registry
      expect(result.missingTables).toHaveLength(FEATURES.contentAutomation.requiredTables.length)
      for (const table of FEATURES.contentAutomation.requiredTables) {
        expect(result.missingTables).toContain(table)
      }
    })
  })
})
