// src/lib/assistant/reasoning/__tests__/validation.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Test file uses partial mocks */
import { describe, it, expect } from "vitest"
import {
  ReasoningEventSchema,
  validateReasoningEvent,
  TerminalPayloadSchema,
  checkAnswerInvariants,
  validateTerminalPayload,
} from "../validation"

describe("Reasoning Validation", () => {
  describe("ReasoningEventSchema", () => {
    it("validates a valid reasoning event", () => {
      const event = {
        v: 1,
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "SOURCES",
        status: "started",
        message: "Searching sources...",
      }

      const result = ReasoningEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })

    it("rejects invalid schema version", () => {
      const event = {
        v: 2, // Invalid
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "SOURCES",
        status: "started",
      }

      const result = ReasoningEventSchema.safeParse(event)
      expect(result.success).toBe(false)
    })

    it("rejects invalid stage", () => {
      const event = {
        v: 1,
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "INVALID_STAGE",
        status: "started",
      }

      const result = ReasoningEventSchema.safeParse(event)
      expect(result.success).toBe(false)
    })
  })

  describe("validateReasoningEvent", () => {
    it("returns valid result for correct event", () => {
      const event = {
        v: 1,
        id: "req_abc_001",
        requestId: "req_abc",
        seq: 1,
        ts: "2025-12-26T10:00:00Z",
        stage: "CONTEXT_RESOLUTION",
        status: "complete",
      }

      const result = validateReasoningEvent(event)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("returns errors for invalid event", () => {
      const event = {
        v: 1,
        // missing required fields
      }

      const result = validateReasoningEvent(event as any)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe("checkAnswerInvariants", () => {
    it("returns valid when all invariants satisfied", () => {
      const payload = {
        asOfDate: "2025-12-26",
        answerHr: "Test answer",
        citations: [
          {
            id: "c1",
            title: "Test",
            authority: "LAW",
            quote: "test",
            url: "https://test.com",
            evidenceId: "e1",
            fetchedAt: "2025-12-26",
          },
        ],
      }
      const result = checkAnswerInvariants(payload, 1, true)
      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it("fails when citations is empty", () => {
      const payload = { asOfDate: "2025-12-26", citations: [] }
      const result = checkAnswerInvariants(payload, 1, true)
      expect(result.valid).toBe(false)
      expect(result.violations).toContain("citations: must be non-empty array")
    })

    it("fails when asOfDate missing", () => {
      const payload = { citations: [{ id: "c1" }] }
      const result = checkAnswerInvariants(payload, 1, true)
      expect(result.valid).toBe(false)
      expect(result.violations).toContain("asOfDate: must be present")
    })

    it("fails when eligibleCount is zero", () => {
      const payload = { asOfDate: "2025-12-26", citations: [{ id: "c1" }] }
      const result = checkAnswerInvariants(payload, 0, true)
      expect(result.valid).toBe(false)
      expect(result.violations).toContain("eligibleRulesCount: must be > 0")
    })

    it("fails when userContext not present", () => {
      const payload = { asOfDate: "2025-12-26", citations: [{ id: "c1" }] }
      const result = checkAnswerInvariants(payload, 1, false)
      expect(result.valid).toBe(false)
      expect(result.violations).toContain("userContextSnapshot: must be frozen at request start")
    })
  })

  describe("validateTerminalPayload", () => {
    it("validates ANSWER payload", () => {
      const payload = {
        outcome: "ANSWER",
        asOfDate: "2025-12-26",
        answerHr: "Test answer",
        citations: [
          {
            id: "c1",
            title: "Test",
            authority: "LAW",
            quote: "test",
            url: "https://test.com",
            evidenceId: "e1",
            fetchedAt: "2025-12-26",
          },
        ],
      }
      const result = validateTerminalPayload(payload)
      expect(result.valid).toBe(true)
    })

    it("validates REFUSAL payload", () => {
      const payload = {
        outcome: "REFUSAL",
        reason: "NO_CITABLE_RULES",
        message: "No applicable rules found",
      }
      const result = validateTerminalPayload(payload)
      expect(result.valid).toBe(true)
    })

    it("rejects invalid outcome", () => {
      const payload = { outcome: "INVALID" }
      const result = validateTerminalPayload(payload)
      expect(result.valid).toBe(false)
    })
  })
})
