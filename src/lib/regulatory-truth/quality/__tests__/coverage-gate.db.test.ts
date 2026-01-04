// src/lib/regulatory-truth/quality/__tests__/coverage-gate.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    atomicClaim: { count: vi.fn() },
    regulatoryProcess: { count: vi.fn() },
    referenceTable: { count: vi.fn() },
    regulatoryAsset: { count: vi.fn() },
    transitionalProvision: { count: vi.fn() },
    sourcePointer: { count: vi.fn() },
    agentRun: { findFirst: vi.fn() },
    coverageReport: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from "@/lib/db"

describe("Coverage Gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the module cache to ensure fresh imports
    vi.resetModules()
  })

  describe("generateCoverageReport", () => {
    it("calculates coverage score for LOGIC content", async () => {
      // Mock counts
      vi.mocked(db.atomicClaim.count).mockResolvedValue(5)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(10)

      // Mock classification
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)

      // Import and run
      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.claimsCount).toBe(5)
      expect(report.coverageScore).toBe(1.0) // LOGIC needs claims, we have claims
      expect(report.isComplete).toBe(true)
      expect(report.primaryContentType).toBe("LOGIC")
    })

    it("marks as incomplete when required shapes are missing", async () => {
      // Mock counts - no claims
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(5)

      // Mock classification as LOGIC
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)

      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.claimsCount).toBe(0)
      expect(report.coverageScore).toBe(0) // Missing required claims
      expect(report.isComplete).toBe(false)
      expect(report.missingShapes).toContain("claims")
    })

    it("calculates correct score for PROCESS content type", async () => {
      // Mock counts - has processes
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(3)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)

      // Mock classification as PROCESS
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "PROCESS", confidence: 0.85 },
      } as any)

      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.processesCount).toBe(3)
      expect(report.coverageScore).toBe(1.0) // PROCESS needs processes, we have them
      expect(report.isComplete).toBe(true)
    })

    it("generates warnings for low classification confidence", async () => {
      vi.mocked(db.atomicClaim.count).mockResolvedValue(2)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)

      // Mock classification with low confidence
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.5 },
      } as any)

      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.warnings).toContainEqual(
        expect.stringContaining("Low classification confidence")
      )
    })

    it("generates warning for legacy source pointers without claims", async () => {
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(5) // Has legacy pointers

      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)

      const { generateCoverageReport } = await import("../coverage-report")
      const report = await generateCoverageReport("test-evidence-id")

      expect(report.warnings).toContainEqual(expect.stringContaining("legacy source pointers"))
    })
  })

  describe("runCoverageGate", () => {
    it("blocks publication when coverage is insufficient", async () => {
      // Setup mocks for low coverage
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { runCoverageGate } = await import("../coverage-gate")
      const result = await runCoverageGate("test-evidence-id")

      expect(result.passed).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
      expect(result.blockers).toContainEqual(
        expect.stringContaining("Missing required shape: claims")
      )
    })

    it("allows publication when coverage meets requirements", async () => {
      // Setup mocks for good coverage
      vi.mocked(db.atomicClaim.count).mockResolvedValue(3)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(5)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { runCoverageGate } = await import("../coverage-gate")
      const result = await runCoverageGate("test-evidence-id")

      expect(result.passed).toBe(true)
      expect(result.blockers.length).toBe(0)
    })

    it("provides recommendations for warnings", async () => {
      // Setup mocks with low confidence
      vi.mocked(db.atomicClaim.count).mockResolvedValue(3)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.5 }, // Low confidence
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { runCoverageGate } = await import("../coverage-gate")
      const result = await runCoverageGate("test-evidence-id")

      expect(result.recommendations).toContainEqual(
        expect.stringContaining("manual content classification")
      )
    })

    it("blocks when score is below minimum for content type", async () => {
      // Setup for REFERENCE type which needs 80% minimum
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0) // Missing required
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "REFERENCE", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { runCoverageGate } = await import("../coverage-gate")
      const result = await runCoverageGate("test-evidence-id")

      expect(result.passed).toBe(false)
      expect(result.blockers).toContainEqual(expect.stringContaining("below minimum"))
    })
  })

  describe("canPublish", () => {
    it("blocks when coverage gate fails", async () => {
      // Setup for failing gate
      vi.mocked(db.atomicClaim.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)

      const { canPublish } = await import("../coverage-gate")
      const result = await canPublish("test-evidence-id")

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain("Coverage gate failed")
    })

    it("blocks when pending reviewer approval", async () => {
      // Setup for passing gate but no approval
      vi.mocked(db.atomicClaim.count).mockResolvedValue(5)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)
      vi.mocked(db.coverageReport.findUnique).mockResolvedValue({
        reviewerApproved: false,
      } as any)

      const { canPublish } = await import("../coverage-gate")
      const result = await canPublish("test-evidence-id")

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain("Pending reviewer approval")
    })

    it("allows when gate passes and reviewer approved", async () => {
      // Setup for passing gate with approval
      vi.mocked(db.atomicClaim.count).mockResolvedValue(5)
      vi.mocked(db.regulatoryProcess.count).mockResolvedValue(0)
      vi.mocked(db.referenceTable.count).mockResolvedValue(0)
      vi.mocked(db.regulatoryAsset.count).mockResolvedValue(0)
      vi.mocked(db.transitionalProvision.count).mockResolvedValue(0)
      vi.mocked(db.sourcePointer.count).mockResolvedValue(0)
      vi.mocked(db.agentRun.findFirst).mockResolvedValue({
        id: "1",
        output: { primaryType: "LOGIC", confidence: 0.9 },
      } as any)
      vi.mocked(db.coverageReport.upsert).mockResolvedValue({} as any)
      vi.mocked(db.coverageReport.findUnique).mockResolvedValue({
        reviewerApproved: true,
      } as any)

      const { canPublish } = await import("../coverage-gate")
      const result = await canPublish("test-evidence-id")

      expect(result.allowed).toBe(true)
      expect(result.reason).toContain("approved")
    })
  })
})
