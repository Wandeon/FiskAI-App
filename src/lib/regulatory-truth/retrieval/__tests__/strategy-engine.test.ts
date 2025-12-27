// src/lib/regulatory-truth/retrieval/__tests__/strategy-engine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { runStrategyEngine, detectStrategyIntent } from "../strategy-engine"

vi.mock("@/lib/db", () => ({
  db: {
    comparisonMatrix: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "matrix-1",
          slug: "pausalni-vs-doo",
          titleHr: "Pausalni obrt vs d.o.o.",
          domainTags: ["STARTING_BUSINESS"],
          options: [],
          criteria: [],
          cells: [],
        },
      ]),
    },
  },
}))

describe("Strategy Engine", () => {
  describe("detectStrategyIntent", () => {
    it("should detect 'should I' pattern", () => {
      expect(detectStrategyIntent("Should I open a d.o.o. or pausalni?")).toBe(true)
    })

    it("should detect 'trebam li' pattern", () => {
      expect(detectStrategyIntent("Trebam li otvoriti obrt ili d.o.o.?")).toBe(true)
    })

    it("should detect 'sto je bolje' pattern", () => {
      expect(detectStrategyIntent("Sto je bolje - pausalni ili normalni PDV?")).toBe(true)
    })

    it("should detect 'koji je bolji' pattern", () => {
      expect(detectStrategyIntent("Koji je bolji izbor za mene?")).toBe(true)
    })

    it("should detect 'vs' pattern", () => {
      expect(detectStrategyIntent("Pausalni obrt vs d.o.o.")).toBe(true)
    })

    it("should detect 'odabrati' pattern", () => {
      expect(detectStrategyIntent("Kako odabrati pravi oblik poslovanja?")).toBe(true)
    })

    it("should return false for non-strategy queries", () => {
      expect(detectStrategyIntent("Koliko iznosi stopa PDV-a?")).toBe(false)
    })

    it("should return false for process queries", () => {
      expect(detectStrategyIntent("Kako se registrirati za PDV?")).toBe(false)
    })
  })

  describe("runStrategyEngine", () => {
    it("should return matching comparison matrices", async () => {
      const result = await runStrategyEngine("Trebam li otvoriti obrt?", {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      })

      expect(result.success).toBe(true)
      expect(result.matrices).toHaveLength(1)
    })

    it("should return success even with empty entities", async () => {
      const result = await runStrategyEngine("Should I choose pausalni?", {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      })

      expect(result.success).toBe(true)
      expect(result.matrices).toBeDefined()
    })

    it("should include relevance score in results", async () => {
      const result = await runStrategyEngine("Pausalni obrt vs d.o.o.", {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      })

      expect(result.success).toBe(true)
      if (result.matrices.length > 0) {
        expect(result.matrices[0]).toHaveProperty("relevanceScore")
      }
    })
  })
})
