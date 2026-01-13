// src/lib/regulatory-truth/agents/__tests__/runner-invariants.test.ts
//
// Tests for outcome invariant enforcement in runner.ts
// Verifies that updateRunOutcome enforces the "SUCCESS_APPLIED implies itemsProduced > 0" contract

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock the db module before importing runner
vi.mock("@/lib/db", () => ({
  db: {
    agentRun: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Import after mocking
import { updateRunOutcome } from "../runner"
import { db } from "@/lib/db"

describe("runner invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("updateRunOutcome", () => {
    it("sets SUCCESS_APPLIED when itemsProduced > 0", async () => {
      await updateRunOutcome("run-123", 5)

      expect(db.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-123" },
        data: expect.objectContaining({
          outcome: "SUCCESS_APPLIED",
          itemsProduced: 5,
        }),
      })
    })

    it("sets SUCCESS_NO_CHANGE when itemsProduced = 0 (INVARIANT ENFORCEMENT)", async () => {
      // This is the critical test: even if caller expects SUCCESS_APPLIED,
      // updateRunOutcome MUST set SUCCESS_NO_CHANGE when itemsProduced = 0
      await updateRunOutcome("run-456", 0)

      expect(db.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-456" },
        data: expect.objectContaining({
          outcome: "SUCCESS_NO_CHANGE",
          itemsProduced: 0,
        }),
      })

      // Should never set SUCCESS_APPLIED with itemsProduced = 0
      const updateCall = vi.mocked(db.agentRun.update).mock.calls[0][0]
      expect(updateCall.data.outcome).not.toBe("SUCCESS_APPLIED")
    })

    it("logs outcome for observability", async () => {
      await updateRunOutcome("run-789", 3)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SUCCESS_APPLIED"))
    })

    it("logs SUCCESS_NO_CHANGE when no items produced", async () => {
      await updateRunOutcome("run-000", 0)

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("SUCCESS_NO_CHANGE"))
    })

    it("includes noChangeCode when itemsProduced = 0", async () => {
      await updateRunOutcome("run-111", 0, "NO_RELEVANT_CHANGES", "All extractions filtered")

      expect(db.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-111" },
        data: expect.objectContaining({
          outcome: "SUCCESS_NO_CHANGE",
          itemsProduced: 0,
          noChangeCode: "NO_RELEVANT_CHANGES",
          noChangeDetail: "All extractions filtered",
        }),
      })
    })

    it("does NOT include noChangeCode when itemsProduced > 0", async () => {
      await updateRunOutcome("run-222", 10, "NO_RELEVANT_CHANGES", "This should be ignored")

      const updateCall = vi.mocked(db.agentRun.update).mock.calls[0][0]
      expect(updateCall.data.noChangeCode).toBeUndefined()
      expect(updateCall.data.noChangeDetail).toBeUndefined()
    })
  })
})
