// src/lib/regulatory-truth/watchdog/__tests__/progress-gates.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  checkEvidenceProgressGate,
  checkExtractionProgressGate,
  checkReleaseProgressGate,
  runProgressGateChecks,
  type ProgressGateResult,
} from "../progress-gates"

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    sourcePointer: { findMany: vi.fn() },
    regulatoryRule: { findMany: vi.fn(), count: vi.fn() },
  },
  dbReg: {
    evidence: { findMany: vi.fn() },
  },
}))

// Mock alerting
vi.mock("../alerting", () => ({
  raiseAlert: vi.fn(),
}))

describe("Progress Gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("checkEvidenceProgressGate", () => {
    it("returns HEALTHY when no stalled evidence", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue([])

      const result = await checkEvidenceProgressGate()
      expect(result.status).toBe("HEALTHY")
      expect(result.stalledCount).toBe(0)
      expect(result.gate).toBe("evidence-to-sourcepointer")
    })

    it("returns WARNING when evidence stalled", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue([
        { id: "ev1", fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
      ] as any)

      const result = await checkEvidenceProgressGate()
      expect(result.status).toBe("WARNING")
      expect(result.stalledCount).toBe(1)
      expect(result.topStalled).toContain("ev1")
    })

    it("returns CRITICAL when many items stalled", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      // 25 stalled items
      const stalled = Array.from({ length: 25 }, (_, i) => ({
        id: `ev${i}`,
        fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      }))
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue(stalled as any)

      const result = await checkEvidenceProgressGate()
      expect(result.status).toBe("CRITICAL")
      expect(result.stalledCount).toBe(25)
    })

    it("excludes evidence that already has source pointers", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")

      // Evidence ev1 has a source pointer
      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([{ evidenceId: "ev1" }] as any)
      // Query should exclude ev1
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue([])

      const result = await checkEvidenceProgressGate()
      expect(result.status).toBe("HEALTHY")
      expect(result.stalledCount).toBe(0)
    })

    it("calculates oldest age correctly", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      // One item, 10 hours old
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue([
        { id: "ev1", fetchedAt: new Date(Date.now() - 10 * 60 * 60 * 1000) },
      ] as any)

      const result = await checkEvidenceProgressGate()
      expect(result.oldestAgeHours).toBeGreaterThanOrEqual(9.9)
      expect(result.oldestAgeHours).toBeLessThanOrEqual(10.1)
    })
  })

  describe("checkExtractionProgressGate", () => {
    it("returns HEALTHY when no stalled source pointers", async () => {
      const { db } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])

      const result = await checkExtractionProgressGate()
      expect(result.status).toBe("HEALTHY")
      expect(result.stalledCount).toBe(0)
      expect(result.gate).toBe("sourcepointer-to-rule")
    })

    it("returns WARNING when source pointers stalled without rules", async () => {
      const { db } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([
        { id: "sp1", createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000) },
      ] as any)

      const result = await checkExtractionProgressGate()
      expect(result.status).toBe("WARNING")
      expect(result.stalledCount).toBe(1)
      expect(result.topStalled).toContain("sp1")
    })

    it("returns CRITICAL when many source pointers stalled", async () => {
      const { db } = await import("@/lib/db")

      const stalled = Array.from({ length: 25 }, (_, i) => ({
        id: `sp${i}`,
        createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      }))
      vi.mocked(db.sourcePointer.findMany).mockResolvedValue(stalled as any)

      const result = await checkExtractionProgressGate()
      expect(result.status).toBe("CRITICAL")
      expect(result.stalledCount).toBe(25)
    })
  })

  describe("checkReleaseProgressGate", () => {
    it("returns HEALTHY when no stalled approved rules", async () => {
      const { db } = await import("@/lib/db")

      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])

      const result = await checkReleaseProgressGate()
      expect(result.status).toBe("HEALTHY")
      expect(result.stalledCount).toBe(0)
      expect(result.gate).toBe("approved-to-published")
    })

    it("returns WARNING when approved rules stalled without release", async () => {
      const { db } = await import("@/lib/db")

      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([
        { id: "rule1", updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      ] as any)

      const result = await checkReleaseProgressGate()
      expect(result.status).toBe("WARNING")
      expect(result.stalledCount).toBe(1)
      expect(result.topStalled).toContain("rule1")
    })

    it("returns CRITICAL when many approved rules stalled", async () => {
      const { db } = await import("@/lib/db")

      const stalled = Array.from({ length: 25 }, (_, i) => ({
        id: `rule${i}`,
        updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      }))
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue(stalled as any)

      const result = await checkReleaseProgressGate()
      expect(result.status).toBe("CRITICAL")
      expect(result.stalledCount).toBe(25)
    })
  })

  describe("runProgressGateChecks", () => {
    it("runs all three gate checks", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue([])
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])

      const results = await runProgressGateChecks()
      expect(results).toHaveLength(3)
      expect(results.map((r) => r.checkType).sort()).toEqual([
        "PROGRESS_GATE_EVIDENCE",
        "PROGRESS_GATE_EXTRACTION",
        "PROGRESS_GATE_RELEASE",
      ])
    })

    it("raises alerts for unhealthy gates", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")
      const { raiseAlert } = await import("../alerting")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      // 5 stalled evidence items (WARNING threshold)
      const stalledEvidence = Array.from({ length: 5 }, (_, i) => ({
        id: `ev${i}`,
        fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      }))
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue(stalledEvidence as any)
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])

      await runProgressGateChecks()

      expect(raiseAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "WARNING",
          type: "PROGRESS_STALL_EVIDENCE",
        })
      )
    })

    it("raises CRITICAL alert when stall count exceeds critical threshold", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")
      const { raiseAlert } = await import("../alerting")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      // 25 stalled evidence items (CRITICAL threshold)
      const stalledEvidence = Array.from({ length: 25 }, (_, i) => ({
        id: `ev${i}`,
        fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      }))
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue(stalledEvidence as any)
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])

      await runProgressGateChecks()

      expect(raiseAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "CRITICAL",
          type: "PROGRESS_STALL_EVIDENCE",
        })
      )
    })

    it("does not raise alerts for healthy gates", async () => {
      const { db } = await import("@/lib/db")
      const { dbReg } = await import("@/lib/db")
      const { raiseAlert } = await import("../alerting")

      vi.mocked(db.sourcePointer.findMany).mockResolvedValue([])
      vi.mocked(dbReg.evidence.findMany).mockResolvedValue([])
      vi.mocked(db.regulatoryRule.findMany).mockResolvedValue([])

      await runProgressGateChecks()

      expect(raiseAlert).not.toHaveBeenCalled()
    })
  })
})
