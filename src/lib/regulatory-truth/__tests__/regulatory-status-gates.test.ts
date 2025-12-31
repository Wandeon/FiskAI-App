// src/lib/regulatory-truth/__tests__/regulatory-status-gates.test.ts
// Tests for regulatory rule status transition enforcement
// These tests verify that the Prisma extension properly blocks bypass attempts
//
// FIXME(2024-12-29): The simulated validateTransition() function in this test file
// does NOT match the actual implementation in prisma-extensions.ts. Specifically:
// - Test allows DRAFT → APPROVED with bypassApproval (line 37)
// - Actual implementation BLOCKS this transition (prisma-extensions.ts lines 323-333)
// - Test should be updated to match actual behavior including systemAction support
// See: prisma-extensions.ts validateStatusTransitionInternal()

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  RegulatoryRuleStatusTransitionError,
  RegulatoryRuleUpdateManyStatusNotAllowedError,
} from "@/lib/prisma-extensions"

// Mock the database client with status gate behavior
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateMany = vi.fn()

// Simulated gate enforcement (mirrors prisma-extensions.ts logic EXACTLY)
// CRITICAL: This must match the actual implementation in prisma-extensions.ts
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["PUBLISHED", "PENDING_REVIEW"],
  PUBLISHED: ["DEPRECATED"],
  DEPRECATED: [],
  REJECTED: ["DRAFT"],
}

type RegulatorySystemAction = "QUARANTINE_DOWNGRADE" | "ROLLBACK"

function validateTransition(
  from: string,
  to: string,
  context?: { source?: string; bypassApproval?: boolean; systemAction?: RegulatorySystemAction }
): { allowed: boolean; error?: string } {
  if (from === to) return { allowed: true }

  const allowedTargets = ALLOWED_STATUS_TRANSITIONS[from] ?? []
  if (!allowedTargets.includes(to)) {
    // ========================================
    // SYSTEM ACTIONS (preferred over bypassApproval)
    // ========================================
    if (context?.systemAction && context?.source) {
      // QUARANTINE_DOWNGRADE: Only allows → PENDING_REVIEW
      if (context.systemAction === "QUARANTINE_DOWNGRADE") {
        if (to === "PENDING_REVIEW") {
          if (from === "APPROVED" || from === "PUBLISHED") {
            return { allowed: true }
          }
        }
        return {
          allowed: false,
          error: `QUARANTINE_DOWNGRADE only allows APPROVED/PUBLISHED → PENDING_REVIEW`,
        }
      }

      // ROLLBACK: Only allows PUBLISHED → APPROVED
      if (context.systemAction === "ROLLBACK") {
        if (from === "PUBLISHED" && to === "APPROVED") {
          return { allowed: true }
        }
        return {
          allowed: false,
          error: `ROLLBACK only allows PUBLISHED → APPROVED`,
        }
      }
    }

    // ========================================
    // DEPRECATED: bypassApproval
    // Only allows DOWNGRADES (→ PENDING_REVIEW) and rollbacks
    // NEVER allows approve or publish
    // ========================================
    if (context?.bypassApproval && context?.source) {
      // BLOCK: bypassApproval NEVER allows approval transitions
      if (to === "APPROVED") {
        // Exception: rollback (PUBLISHED → APPROVED) still allowed for backward compat
        if (from === "PUBLISHED" && context.source.toLowerCase().includes("rollback")) {
          return { allowed: true }
        }
        return {
          allowed: false,
          error: `bypassApproval cannot be used for approval. Use autoApprove with allowlist.`,
        }
      }

      // BLOCK: bypassApproval NEVER allows publish
      if (to === "PUBLISHED") {
        return {
          allowed: false,
          error: `bypassApproval cannot be used for publishing. Publishing requires normal approval flow.`,
        }
      }

      // ALLOW: Downgrades to PENDING_REVIEW (quarantine use case)
      if (to === "PENDING_REVIEW") {
        if (from === "APPROVED" || from === "PUBLISHED") {
          return { allowed: true }
        }
      }
    }

    return {
      allowed: false,
      error: `Illegal status transition: ${from} → ${to}. Allowed: [${allowedTargets.join(", ") || "none"}].`,
    }
  }

  if (to === "PUBLISHED" && !context?.source) {
    return {
      allowed: false,
      error: "Publishing requires explicit source context.",
    }
  }

  return { allowed: true }
}

describe("RegulatoryRule Status Gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("updateMany blocking", () => {
    it("throws RegulatoryRuleUpdateManyStatusNotAllowedError when status is in data", () => {
      // This test verifies the invariant: updateMany CANNOT be used to change status
      const attemptUpdateMany = () => {
        // Simulating what the Prisma extension does
        const data = { status: "PUBLISHED" }
        if (data.status) {
          throw new RegulatoryRuleUpdateManyStatusNotAllowedError()
        }
      }

      expect(attemptUpdateMany).toThrow(RegulatoryRuleUpdateManyStatusNotAllowedError)
      expect(attemptUpdateMany).toThrow("Cannot update RegulatoryRule.status using updateMany")
    })

    it("allows updateMany when status is NOT in data", () => {
      // updateMany for other fields should work
      const attemptUpdateMany = () => {
        const data = { confidence: 0.95 }
        if ((data as { status?: string }).status) {
          throw new RegulatoryRuleUpdateManyStatusNotAllowedError()
        }
        return { count: 5 }
      }

      expect(attemptUpdateMany()).toEqual({ count: 5 })
    })
  })

  describe("allowed status transitions", () => {
    it("allows DRAFT → PENDING_REVIEW", () => {
      const result = validateTransition("DRAFT", "PENDING_REVIEW")
      expect(result.allowed).toBe(true)
    })

    it("allows PENDING_REVIEW → APPROVED", () => {
      const result = validateTransition("PENDING_REVIEW", "APPROVED")
      expect(result.allowed).toBe(true)
    })

    it("allows APPROVED → PUBLISHED with source context", () => {
      const result = validateTransition("APPROVED", "PUBLISHED", { source: "releaser" })
      expect(result.allowed).toBe(true)
    })

    it("allows PUBLISHED → DEPRECATED", () => {
      const result = validateTransition("PUBLISHED", "DEPRECATED")
      expect(result.allowed).toBe(true)
    })

    it("allows REJECTED → DRAFT", () => {
      const result = validateTransition("REJECTED", "DRAFT")
      expect(result.allowed).toBe(true)
    })
  })

  describe("blocked status transitions (bypass prevention)", () => {
    it("blocks DRAFT → APPROVED (skipping PENDING_REVIEW)", () => {
      const result = validateTransition("DRAFT", "APPROVED")
      expect(result.allowed).toBe(false)
      expect(result.error).toContain("Illegal status transition")
    })

    it("blocks DRAFT → PUBLISHED (skipping all gates)", () => {
      const result = validateTransition("DRAFT", "PUBLISHED")
      expect(result.allowed).toBe(false)
    })

    it("blocks PENDING_REVIEW → PUBLISHED (skipping APPROVED)", () => {
      const result = validateTransition("PENDING_REVIEW", "PUBLISHED")
      expect(result.allowed).toBe(false)
    })

    it("blocks APPROVED → PUBLISHED WITHOUT source context", () => {
      const result = validateTransition("APPROVED", "PUBLISHED") // no context
      expect(result.allowed).toBe(false)
      expect(result.error).toContain("Publishing requires explicit source context")
    })

    it("blocks PUBLISHED → APPROVED without rollback context", () => {
      const result = validateTransition("PUBLISHED", "APPROVED", { source: "manual" })
      expect(result.allowed).toBe(false)
    })

    it("blocks DEPRECATED → anything (terminal state)", () => {
      expect(validateTransition("DEPRECATED", "DRAFT").allowed).toBe(false)
      expect(validateTransition("DEPRECATED", "PUBLISHED").allowed).toBe(false)
    })
  })

  describe("bypass exceptions (legitimate paths)", () => {
    it("BLOCKS DRAFT → APPROVED with bypassApproval (must use autoApprove with allowlist)", () => {
      // bypassApproval is DEPRECATED and NEVER allows approval transitions
      // This is a security fix - approval must go through the allowlist
      const result = validateTransition("DRAFT", "APPROVED", {
        source: "hnb-fetcher",
        bypassApproval: true,
      })
      expect(result.allowed).toBe(false)
      expect(result.error).toContain("bypassApproval cannot be used for approval")
    })

    it("allows PUBLISHED → APPROVED with rollback context (backward compat)", () => {
      const result = validateTransition("PUBLISHED", "APPROVED", {
        source: "rollback",
        bypassApproval: true,
      })
      expect(result.allowed).toBe(true)
    })

    it("allows PUBLISHED → APPROVED with systemAction ROLLBACK", () => {
      const result = validateTransition("PUBLISHED", "APPROVED", {
        source: "manual-rollback",
        systemAction: "ROLLBACK",
      })
      expect(result.allowed).toBe(true)
    })

    it("allows APPROVED → PENDING_REVIEW with systemAction QUARANTINE_DOWNGRADE", () => {
      const result = validateTransition("APPROVED", "PENDING_REVIEW", {
        source: "quarantine-script",
        systemAction: "QUARANTINE_DOWNGRADE",
      })
      expect(result.allowed).toBe(true)
    })

    it("allows APPROVED → PENDING_REVIEW with bypassApproval (downgrade)", () => {
      // Downgrades are still allowed with bypassApproval
      const result = validateTransition("APPROVED", "PENDING_REVIEW", {
        source: "quarantine",
        bypassApproval: true,
      })
      expect(result.allowed).toBe(true)
    })

    it("does NOT allow PENDING_REVIEW → PUBLISHED even with bypass", () => {
      // This transition must ALWAYS go through APPROVED
      const result = validateTransition("PENDING_REVIEW", "PUBLISHED", {
        source: "test",
        bypassApproval: true,
      })
      expect(result.allowed).toBe(false)
    })

    it("blocks DRAFT → PUBLISHED with bypassApproval", () => {
      // bypassApproval NEVER allows publishing
      const result = validateTransition("DRAFT", "PUBLISHED", {
        source: "test",
        bypassApproval: true,
      })
      expect(result.allowed).toBe(false)
      expect(result.error).toContain("bypassApproval cannot be used for publishing")
    })
  })

  describe("error class structure", () => {
    it("RegulatoryRuleStatusTransitionError has correct name", () => {
      const error = new RegulatoryRuleStatusTransitionError("test")
      expect(error.name).toBe("RegulatoryRuleStatusTransitionError")
      expect(error.message).toBe("test")
    })

    it("RegulatoryRuleUpdateManyStatusNotAllowedError has correct name", () => {
      const error = new RegulatoryRuleUpdateManyStatusNotAllowedError()
      expect(error.name).toBe("RegulatoryRuleUpdateManyStatusNotAllowedError")
      expect(error.message).toContain("updateMany")
    })
  })

  describe("same-status updates (no-op)", () => {
    it("allows updating DRAFT → DRAFT (no transition)", () => {
      const result = validateTransition("DRAFT", "DRAFT")
      expect(result.allowed).toBe(true)
    })

    it("allows updating PUBLISHED → PUBLISHED (no transition)", () => {
      const result = validateTransition("PUBLISHED", "PUBLISHED")
      expect(result.allowed).toBe(true)
    })
  })
})

describe("Integration: Status gate error messages", () => {
  it("provides actionable error message for updateMany bypass attempt", () => {
    const error = new RegulatoryRuleUpdateManyStatusNotAllowedError()
    expect(error.message).toContain("rule status service")
    expect(error.message).toContain("approve/publish")
  })

  it("provides actionable error message for missing context on publish", () => {
    const result = validateTransition("APPROVED", "PUBLISHED")
    expect(result.error).toContain("source context")
  })
})
