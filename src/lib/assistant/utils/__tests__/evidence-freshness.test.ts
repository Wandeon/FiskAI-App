/**
 * Tests for evidence freshness validation
 * Related: GitHub issue #158
 */

import { describe, it, expect } from "vitest"
import {
  checkEvidenceFreshness,
  formatFreshnessWarning,
  calculateFreshnessPenalty,
  getFreshnessThreshold,
  calculateDaysSinceFetch,
  FRESHNESS_THRESHOLDS,
  WARNING_THRESHOLD_DAYS,
  type EvidenceFreshnessStatus,
} from "../evidence-freshness"
import type { AuthorityLevel } from "@/lib/assistant/types"

describe("evidence-freshness", () => {
  const now = new Date("2025-01-15T12:00:00Z")

  describe("getFreshnessThreshold", () => {
    it("should return correct thresholds for each authority level", () => {
      expect(getFreshnessThreshold("LAW")).toBe(90)
      expect(getFreshnessThreshold("REGULATION")).toBe(60)
      expect(getFreshnessThreshold("GUIDANCE")).toBe(30)
      expect(getFreshnessThreshold("PRACTICE")).toBe(14)
    })
  })

  describe("calculateDaysSinceFetch", () => {
    it("should calculate days correctly", () => {
      const fetchedAt = new Date("2025-01-01T12:00:00Z")
      expect(calculateDaysSinceFetch(fetchedAt, now)).toBe(14)
    })

    it("should handle same day", () => {
      expect(calculateDaysSinceFetch(now, now)).toBe(0)
    })

    it("should handle partial days", () => {
      const fetchedAt = new Date("2025-01-14T18:00:00Z")
      expect(calculateDaysSinceFetch(fetchedAt, now)).toBe(0)
    })
  })

  describe("checkEvidenceFreshness - LAW authority", () => {
    const authority: AuthorityLevel = "LAW"
    const threshold = FRESHNESS_THRESHOLDS.LAW // 90 days

    it("should mark as fresh when within threshold", () => {
      const fetchedAt = new Date("2024-11-01T12:00:00Z") // 75 days ago
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("fresh")
      expect(result.daysSinceFetch).toBe(75)
      expect(result.threshold).toBe(90)
      expect(result.shouldWarn).toBe(false)
      expect(result.shouldRefetch).toBe(false)
    })

    it("should mark as aging when approaching threshold", () => {
      const warningStart = threshold - WARNING_THRESHOLD_DAYS // 83 days
      const fetchedAt = new Date("2024-10-24T12:00:00Z") // 83 days ago
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("aging")
      expect(result.daysSinceFetch).toBe(83)
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(false)
    })

    it("should mark as stale when beyond threshold", () => {
      const fetchedAt = new Date("2024-09-15T12:00:00Z") // 122 days ago
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("stale")
      expect(result.daysSinceFetch).toBe(122)
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(true)
    })

    it("should mark as critical when very old (3x threshold)", () => {
      const fetchedAt = new Date("2024-03-01T12:00:00Z") // 320 days ago
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("critical")
      expect(result.daysSinceFetch).toBe(320)
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(true)
    })
  })

  describe("checkEvidenceFreshness - PRACTICE authority", () => {
    const authority: AuthorityLevel = "PRACTICE"
    const threshold = FRESHNESS_THRESHOLDS.PRACTICE // 14 days

    it("should mark as fresh when within threshold (before warning period)", () => {
      const fetchedAt = new Date("2025-01-10T12:00:00Z") // 5 days ago (within fresh period: 0-6 days)
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("fresh")
      expect(result.daysSinceFetch).toBe(5)
      expect(result.shouldWarn).toBe(false)
    })

    it("should mark as aging when approaching threshold", () => {
      const fetchedAt = new Date("2025-01-08T12:00:00Z") // 7 days ago
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("aging")
      expect(result.daysSinceFetch).toBe(7)
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(false)
    })

    it("should mark as stale when beyond threshold", () => {
      const fetchedAt = new Date("2024-12-25T12:00:00Z") // 21 days ago
      const result = checkEvidenceFreshness(fetchedAt, authority, false, now)

      expect(result.status).toBe("stale")
      expect(result.daysSinceFetch).toBe(21)
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(true)
    })
  })

  describe("checkEvidenceFreshness - hasChanged flag", () => {
    it("should mark as critical when hasChanged is true", () => {
      const fetchedAt = new Date("2025-01-14T12:00:00Z") // 1 day ago
      const result = checkEvidenceFreshness(fetchedAt, "LAW", true, now)

      expect(result.status).toBe("critical")
      expect(result.message).toContain("changed")
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(true)
    })

    it("should override fresh status when hasChanged is true", () => {
      const fetchedAt = new Date("2025-01-14T12:00:00Z") // Recent fetch
      const result = checkEvidenceFreshness(fetchedAt, "PRACTICE", true, now)

      expect(result.status).toBe("critical")
      expect(result.shouldRefetch).toBe(true)
    })
  })

  describe("checkEvidenceFreshness - missing fetchedAt", () => {
    it("should mark as critical when fetchedAt is null", () => {
      const result = checkEvidenceFreshness(null, "LAW", false, now)

      expect(result.status).toBe("critical")
      expect(result.daysSinceFetch).toBe(0)
      expect(result.shouldWarn).toBe(true)
      expect(result.shouldRefetch).toBe(false)
      expect(result.message).toContain("No fetch date")
    })
  })

  describe("formatFreshnessWarning", () => {
    it("should return null for fresh evidence", () => {
      const check = {
        status: "fresh" as EvidenceFreshnessStatus,
        daysSinceFetch: 10,
        threshold: 90,
        message: "Fresh",
        shouldWarn: false,
        shouldRefetch: false,
      }
      expect(formatFreshnessWarning(check)).toBeNull()
    })

    it("should return warning for aging evidence", () => {
      const check = {
        status: "aging" as EvidenceFreshnessStatus,
        daysSinceFetch: 85,
        threshold: 90,
        message: "Aging",
        shouldWarn: true,
        shouldRefetch: false,
      }
      const warning = formatFreshnessWarning(check)
      expect(warning).toBe("Last verified 85 days ago")
    })

    it("should return warning for stale evidence", () => {
      const check = {
        status: "stale" as EvidenceFreshnessStatus,
        daysSinceFetch: 120,
        threshold: 90,
        message: "Stale",
        shouldWarn: true,
        shouldRefetch: true,
      }
      const warning = formatFreshnessWarning(check)
      expect(warning).toBe("Last verified 120 days ago")
    })

    it("should return changed message for critical evidence with changed flag", () => {
      const check = {
        status: "critical" as EvidenceFreshnessStatus,
        daysSinceFetch: 10,
        threshold: 90,
        message: "Source content has changed - evidence needs re-extraction",
        shouldWarn: true,
        shouldRefetch: true,
      }
      const warning = formatFreshnessWarning(check)
      expect(warning).toBe("Source content has changed - this citation may be outdated")
    })

    it("should return outdated message for critical old evidence", () => {
      const check = {
        status: "critical" as EvidenceFreshnessStatus,
        daysSinceFetch: 300,
        threshold: 90,
        message: "Very old",
        shouldWarn: true,
        shouldRefetch: true,
      }
      const warning = formatFreshnessWarning(check)
      expect(warning).toBe("Last verified 300 days ago - may be outdated")
    })
  })

  describe("calculateFreshnessPenalty", () => {
    it("should apply no penalty for fresh evidence", () => {
      const check = {
        status: "fresh" as EvidenceFreshnessStatus,
        daysSinceFetch: 10,
        threshold: 90,
        message: "",
        shouldWarn: false,
        shouldRefetch: false,
      }
      expect(calculateFreshnessPenalty(check)).toBe(1.0)
    })

    it("should apply minor penalty for aging evidence", () => {
      const check = {
        status: "aging" as EvidenceFreshnessStatus,
        daysSinceFetch: 85,
        threshold: 90,
        message: "",
        shouldWarn: true,
        shouldRefetch: false,
      }
      expect(calculateFreshnessPenalty(check)).toBe(0.95)
    })

    it("should apply moderate penalty for stale evidence", () => {
      const check = {
        status: "stale" as EvidenceFreshnessStatus,
        daysSinceFetch: 120,
        threshold: 90,
        message: "",
        shouldWarn: true,
        shouldRefetch: true,
      }
      expect(calculateFreshnessPenalty(check)).toBe(0.85)
    })

    it("should apply significant penalty for critical evidence", () => {
      const check = {
        status: "critical" as EvidenceFreshnessStatus,
        daysSinceFetch: 300,
        threshold: 90,
        message: "",
        shouldWarn: true,
        shouldRefetch: true,
      }
      expect(calculateFreshnessPenalty(check)).toBe(0.7)
    })

    it("should reduce confidence appropriately", () => {
      const originalConfidence = 0.9

      const agingCheck = {
        status: "aging" as EvidenceFreshnessStatus,
        daysSinceFetch: 85,
        threshold: 90,
        message: "",
        shouldWarn: true,
        shouldRefetch: false,
      }
      expect(originalConfidence * calculateFreshnessPenalty(agingCheck)).toBe(0.855)

      const staleCheck = {
        status: "stale" as EvidenceFreshnessStatus,
        daysSinceFetch: 120,
        threshold: 90,
        message: "",
        shouldWarn: true,
        shouldRefetch: true,
      }
      expect(originalConfidence * calculateFreshnessPenalty(staleCheck)).toBe(0.765)

      const criticalCheck = {
        status: "critical" as EvidenceFreshnessStatus,
        daysSinceFetch: 300,
        threshold: 90,
        message: "",
        shouldWarn: true,
        shouldRefetch: true,
      }
      expect(originalConfidence * calculateFreshnessPenalty(criticalCheck)).toBe(0.63)
    })
  })

  describe("threshold boundary conditions", () => {
    it("should handle exact threshold boundary (LAW = 90 days)", () => {
      const fetchedAt = new Date("2024-10-17T12:00:00Z") // Exactly 90 days ago
      const result = checkEvidenceFreshness(fetchedAt, "LAW", false, now)

      expect(result.daysSinceFetch).toBe(90)
      // 90 days is within the warning period (83-90), so it's aging, not fresh
      expect(result.status).toBe("aging")
    })

    it("should handle threshold + 1 day (LAW = 91 days)", () => {
      const fetchedAt = new Date("2024-10-16T12:00:00Z") // 91 days ago
      const result = checkEvidenceFreshness(fetchedAt, "LAW", false, now)

      expect(result.daysSinceFetch).toBe(91)
      expect(result.status).toBe("stale")
    })

    it("should handle warning threshold boundary", () => {
      const threshold = FRESHNESS_THRESHOLDS.LAW // 90
      const warningStart = threshold - WARNING_THRESHOLD_DAYS // 83

      const fetchedAt = new Date("2024-10-24T12:00:00Z") // Exactly 83 days ago
      const result = checkEvidenceFreshness(fetchedAt, "LAW", false, now)

      expect(result.daysSinceFetch).toBe(83)
      expect(result.status).toBe("aging")
    })
  })
})
