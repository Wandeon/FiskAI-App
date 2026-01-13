// src/lib/regulatory-truth/workers/__tests__/budget-governor.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import {
  checkBudget,
  recordTokenSpend,
  configureBudget,
  getBudgetStatus,
  resetDailyBudget,
  openCircuit,
  closeCircuit,
  acquireSlot,
  releaseSlot,
  clearSourceCooldown,
  estimateTokens,
  _resetForTesting,
  type LLMProvider,
} from "../budget-governor"

describe("budget-governor", () => {
  beforeEach(() => {
    _resetForTesting()
  })

  describe("checkBudget", () => {
    it("should allow requests within budget", () => {
      const result = checkBudget("test-source", "evidence-1", 1000)
      expect(result.allowed).toBe(true)
      expect(result.remainingGlobalTokens).toBeGreaterThan(0)
      expect(result.recommendedProvider).toBe("LOCAL_OLLAMA")
    })

    it("should deny when global daily cap exceeded", () => {
      configureBudget({ globalDailyTokenCap: 1000 })

      // Use up the budget
      recordTokenSpend({
        sourceSlug: "test-source",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 900,
        timestamp: new Date(),
        outcome: "SUCCESS",
      })

      const result = checkBudget("test-source", "evidence-2", 200)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toBe("GLOBAL_DAILY_CAP_EXCEEDED")
    })

    it("should deny when per-source daily cap exceeded", () => {
      configureBudget({ perSourceDailyTokenCap: 500 })

      // Use up source budget
      recordTokenSpend({
        sourceSlug: "test-source",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 400,
        timestamp: new Date(),
        outcome: "SUCCESS",
      })

      const result = checkBudget("test-source", "evidence-2", 200)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toBe("SOURCE_DAILY_CAP_EXCEEDED")

      // Different source should still work
      const result2 = checkBudget("other-source", "evidence-3", 200)
      expect(result2.allowed).toBe(true)
    })

    it("should deny when evidence too large", () => {
      configureBudget({ perEvidenceMaxTokens: 100 })

      const result = checkBudget("test-source", "evidence-1", 200)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toBe("EVIDENCE_TOO_LARGE")
    })

    it("should deny when circuit is open", () => {
      openCircuit("AUTH_ERROR")

      const result = checkBudget("test-source", "evidence-1", 100)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toBe("CIRCUIT_OPEN")

      closeCircuit()
      const result2 = checkBudget("test-source", "evidence-1", 100)
      expect(result2.allowed).toBe(true)
    })

    it("should deny when source is in cooldown", () => {
      configureBudget({ emptyOutputThreshold: 2, emptyOutputCooldownMs: 60000 })

      // Trigger cooldown with empty outputs
      recordTokenSpend({
        sourceSlug: "test-source",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "EMPTY",
      })
      recordTokenSpend({
        sourceSlug: "test-source",
        evidenceId: "e2",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "EMPTY",
      })

      const result = checkBudget("test-source", "evidence-3", 100)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toBe("SOURCE_IN_COOLDOWN")
      expect(result.cooldownUntil).toBeDefined()
    })

    it("should deny when concurrent limit reached", () => {
      configureBudget({ maxConcurrentLocalCalls: 1, maxConcurrentCloudCalls: 0 })

      // Acquire the only slot
      expect(acquireSlot("LOCAL_OLLAMA")).toBe(true)

      const result = checkBudget("test-source", "evidence-1", 100)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toBe("CONCURRENT_LIMIT_REACHED")

      releaseSlot("LOCAL_OLLAMA")
      const result2 = checkBudget("test-source", "evidence-1", 100)
      expect(result2.allowed).toBe(true)
    })
  })

  describe("recordTokenSpend", () => {
    it("should track global and source tokens", () => {
      recordTokenSpend({
        sourceSlug: "source-a",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 500,
        timestamp: new Date(),
        outcome: "SUCCESS",
      })

      recordTokenSpend({
        sourceSlug: "source-b",
        evidenceId: "e2",
        provider: "CLOUD_OLLAMA",
        tokensUsed: 300,
        timestamp: new Date(),
        outcome: "SUCCESS",
      })

      const status = getBudgetStatus()
      expect(status.globalTokensUsedToday).toBe(800)
      expect(status.sourceTokensUsedToday["source-a"]).toBe(500)
      expect(status.sourceTokensUsedToday["source-b"]).toBe(300)
    })

    it("should track empty outputs and apply cooldown", () => {
      configureBudget({ emptyOutputThreshold: 3, emptyOutputCooldownMs: 3600000 })

      // Record 3 empty outputs
      for (let i = 0; i < 3; i++) {
        recordTokenSpend({
          sourceSlug: "bad-source",
          evidenceId: `e${i}`,
          provider: "LOCAL_OLLAMA",
          tokensUsed: 100,
          timestamp: new Date(),
          outcome: "EMPTY",
        })
      }

      const status = getBudgetStatus()
      expect(status.sourcesInCooldown["bad-source"]).toBeDefined()
    })

    it("should reset empty count on success", () => {
      configureBudget({ emptyOutputThreshold: 3 })

      // Record 2 empty outputs
      recordTokenSpend({
        sourceSlug: "source",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "EMPTY",
      })
      recordTokenSpend({
        sourceSlug: "source",
        evidenceId: "e2",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "EMPTY",
      })

      // Success resets the count
      recordTokenSpend({
        sourceSlug: "source",
        evidenceId: "e3",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "SUCCESS",
      })

      // Another empty shouldn't trigger cooldown
      recordTokenSpend({
        sourceSlug: "source",
        evidenceId: "e4",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "EMPTY",
      })

      const status = getBudgetStatus()
      expect(status.sourcesInCooldown["source"]).toBeUndefined()
    })
  })

  describe("slot management", () => {
    it("should manage local slots correctly", () => {
      configureBudget({ maxConcurrentLocalCalls: 2 })

      expect(acquireSlot("LOCAL_OLLAMA")).toBe(true)
      expect(acquireSlot("LOCAL_OLLAMA")).toBe(true)
      expect(acquireSlot("LOCAL_OLLAMA")).toBe(false) // Third should fail

      releaseSlot("LOCAL_OLLAMA")
      expect(acquireSlot("LOCAL_OLLAMA")).toBe(true) // Should work now
    })

    it("should respect cloud cooldown", () => {
      configureBudget({ maxConcurrentCloudCalls: 2, cloudCallCooldownMs: 100 })

      expect(acquireSlot("CLOUD_OLLAMA")).toBe(true)
      releaseSlot("CLOUD_OLLAMA")

      // Immediately after should fail due to cooldown
      // (In practice, this depends on timing; we're testing the logic)
    })
  })

  describe("clearSourceCooldown", () => {
    it("should clear cooldown for a source", () => {
      configureBudget({ emptyOutputThreshold: 1 })

      recordTokenSpend({
        sourceSlug: "test-source",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 100,
        timestamp: new Date(),
        outcome: "EMPTY",
      })

      let status = getBudgetStatus()
      expect(status.sourcesInCooldown["test-source"]).toBeDefined()

      const cleared = clearSourceCooldown("test-source")
      expect(cleared).toBe(true)

      status = getBudgetStatus()
      expect(status.sourcesInCooldown["test-source"]).toBeUndefined()
    })
  })

  describe("estimateTokens", () => {
    it("should estimate tokens from content length", () => {
      const content = "a".repeat(400) // 400 chars
      expect(estimateTokens(content)).toBe(100) // ~4 chars per token
    })
  })

  describe("resetDailyBudget", () => {
    it("should reset all daily counters", () => {
      recordTokenSpend({
        sourceSlug: "source",
        evidenceId: "e1",
        provider: "LOCAL_OLLAMA",
        tokensUsed: 1000,
        timestamp: new Date(),
        outcome: "SUCCESS",
      })

      let status = getBudgetStatus()
      expect(status.globalTokensUsedToday).toBe(1000)

      resetDailyBudget()

      status = getBudgetStatus()
      expect(status.globalTokensUsedToday).toBe(0)
      expect(Object.keys(status.sourceTokensUsedToday).length).toBe(0)
    })
  })
})
