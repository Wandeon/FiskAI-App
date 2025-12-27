// src/lib/regulatory-truth/utils/__tests__/temporal-filter.test.ts

import { describe, it, expect } from "vitest"
import {
  isTemporallyEffective,
  filterByTemporalEffectiveness,
  partitionByTemporalEffectiveness,
  buildTemporalWhereClause,
  mergeTemporalFilter,
  normalizeToStartOfDay,
  getCurrentEffectiveDate,
  type TemporallyBoundedEntity,
} from "../temporal-filter"

describe("Temporal Filtering Utility", () => {
  describe("normalizeToStartOfDay", () => {
    it("normalizes date with time to start of day", () => {
      const dateWithTime = new Date("2025-06-15T14:30:45.123Z")
      const normalized = normalizeToStartOfDay(dateWithTime)

      expect(normalized.getUTCHours()).toBe(0)
      expect(normalized.getUTCMinutes()).toBe(0)
      expect(normalized.getUTCSeconds()).toBe(0)
      expect(normalized.getUTCMilliseconds()).toBe(0)
      expect(normalized.getUTCDate()).toBe(15)
      expect(normalized.getUTCMonth()).toBe(5) // June is month 5 (0-indexed)
      expect(normalized.getUTCFullYear()).toBe(2025)
    })

    it("does not modify original date", () => {
      const original = new Date("2025-06-15T14:30:45.123Z")
      const originalTime = original.getTime()
      normalizeToStartOfDay(original)

      expect(original.getTime()).toBe(originalTime)
    })
  })

  describe("isTemporallyEffective", () => {
    describe("effectiveFrom boundary (inclusive)", () => {
      it("returns VALID when query date equals effectiveFrom", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-01-01"),
          effectiveUntil: null,
        }
        const queryDate = new Date("2025-01-01")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(true)
        expect(result.reason).toBe("VALID")
      })

      it("returns VALID when query date is after effectiveFrom", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-01-01"),
          effectiveUntil: null,
        }
        const queryDate = new Date("2025-06-15")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(true)
        expect(result.reason).toBe("VALID")
      })

      it("returns FUTURE when query date is before effectiveFrom", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-06-01"),
          effectiveUntil: null,
        }
        const queryDate = new Date("2025-05-31")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(false)
        expect(result.reason).toBe("FUTURE")
      })
    })

    describe("effectiveUntil boundary (exclusive)", () => {
      it("returns EXPIRED when query date equals effectiveUntil", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-01-01"),
          effectiveUntil: new Date("2025-06-15"),
        }
        const queryDate = new Date("2025-06-15")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(false)
        expect(result.reason).toBe("EXPIRED")
      })

      it("returns VALID when query date is one day before effectiveUntil", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-01-01"),
          effectiveUntil: new Date("2025-06-15"),
        }
        const queryDate = new Date("2025-06-14")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(true)
        expect(result.reason).toBe("VALID")
      })

      it("returns EXPIRED when query date is after effectiveUntil", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-01-01"),
          effectiveUntil: new Date("2025-06-15"),
        }
        const queryDate = new Date("2025-06-16")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(false)
        expect(result.reason).toBe("EXPIRED")
      })

      it("returns VALID when effectiveUntil is null (never expires)", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-01-01"),
          effectiveUntil: null,
        }
        const queryDate = new Date("2099-12-31")

        const result = isTemporallyEffective(entity, queryDate)

        expect(result.isEffective).toBe(true)
        expect(result.reason).toBe("VALID")
      })
    })

    describe("time component handling", () => {
      it("ignores time components when comparing dates", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-06-15T23:59:59.999Z"),
          effectiveUntil: new Date("2025-06-30T00:00:00.001Z"),
        }

        // Query at start of day should match
        const morningQuery = new Date("2025-06-20T08:00:00Z")
        expect(isTemporallyEffective(entity, morningQuery).isEffective).toBe(true)

        // Query at end of day should match
        const eveningQuery = new Date("2025-06-20T23:59:59Z")
        expect(isTemporallyEffective(entity, eveningQuery).isEffective).toBe(true)
      })

      it("effectiveFrom boundary with time component", () => {
        const entity: TemporallyBoundedEntity = {
          effectiveFrom: new Date("2025-06-15T12:00:00Z"),
          effectiveUntil: null,
        }

        // Morning of effectiveFrom day should be valid (normalized to same day)
        const morningOfDay = new Date("2025-06-15T06:00:00Z")
        expect(isTemporallyEffective(entity, morningOfDay).isEffective).toBe(true)
      })
    })
  })

  describe("filterByTemporalEffectiveness", () => {
    it("filters out expired and future rules", () => {
      const entities: (TemporallyBoundedEntity & { id: string })[] = [
        { id: "1", effectiveFrom: new Date("2020-01-01"), effectiveUntil: new Date("2024-12-31") }, // Expired
        { id: "2", effectiveFrom: new Date("2025-01-01"), effectiveUntil: null }, // Valid
        { id: "3", effectiveFrom: new Date("2026-01-01"), effectiveUntil: null }, // Future
        { id: "4", effectiveFrom: new Date("2024-01-01"), effectiveUntil: new Date("2026-01-01") }, // Valid
      ]
      const queryDate = new Date("2025-06-15")

      const result = filterByTemporalEffectiveness(entities, queryDate)

      expect(result.length).toBe(2)
      expect(result.map((e) => e.id)).toEqual(["2", "4"])
    })

    it("returns empty array when no rules are effective", () => {
      const entities: TemporallyBoundedEntity[] = [
        { effectiveFrom: new Date("2020-01-01"), effectiveUntil: new Date("2024-12-31") },
      ]
      const queryDate = new Date("2025-06-15")

      const result = filterByTemporalEffectiveness(entities, queryDate)

      expect(result).toEqual([])
    })
  })

  describe("partitionByTemporalEffectiveness", () => {
    it("correctly partitions entities into effective, expired, and future", () => {
      const entities: (TemporallyBoundedEntity & { id: string })[] = [
        {
          id: "expired-1",
          effectiveFrom: new Date("2020-01-01"),
          effectiveUntil: new Date("2024-12-31"),
        },
        {
          id: "expired-2",
          effectiveFrom: new Date("2023-01-01"),
          effectiveUntil: new Date("2025-01-01"),
        },
        { id: "valid-1", effectiveFrom: new Date("2025-01-01"), effectiveUntil: null },
        {
          id: "valid-2",
          effectiveFrom: new Date("2024-06-01"),
          effectiveUntil: new Date("2026-01-01"),
        },
        { id: "future-1", effectiveFrom: new Date("2026-01-01"), effectiveUntil: null },
        { id: "future-2", effectiveFrom: new Date("2025-07-01"), effectiveUntil: null },
      ]
      const queryDate = new Date("2025-06-15")

      const result = partitionByTemporalEffectiveness(entities, queryDate)

      expect(result.expired.map((e) => e.id)).toEqual(["expired-1", "expired-2"])
      expect(result.effective.map((e) => e.id)).toEqual(["valid-1", "valid-2"])
      expect(result.future.map((e) => e.id)).toEqual(["future-1", "future-2"])
    })
  })

  describe("buildTemporalWhereClause", () => {
    it("builds correct Prisma where clause structure", () => {
      const queryDate = new Date("2025-06-15")
      const clause = buildTemporalWhereClause(queryDate)

      expect(clause).toHaveProperty("effectiveFrom")
      expect(clause.effectiveFrom).toHaveProperty("lte")
      expect(clause).toHaveProperty("OR")
      expect(Array.isArray(clause.OR)).toBe(true)
      expect(clause.OR).toHaveLength(2)
    })

    it("includes null check for effectiveUntil", () => {
      const queryDate = new Date("2025-06-15")
      const clause = buildTemporalWhereClause(queryDate)

      const hasNullCheck = clause.OR?.some(
        (condition) => (condition as { effectiveUntil: null }).effectiveUntil === null
      )
      expect(hasNullCheck).toBe(true)
    })

    it("includes gt check for effectiveUntil", () => {
      const queryDate = new Date("2025-06-15")
      const clause = buildTemporalWhereClause(queryDate)

      const hasGtCheck = clause.OR?.some(
        (condition) =>
          (condition as { effectiveUntil: { gt: Date } }).effectiveUntil?.gt !== undefined
      )
      expect(hasGtCheck).toBe(true)
    })
  })

  describe("mergeTemporalFilter", () => {
    it("merges temporal filter with simple where clause", () => {
      const existingWhere = { status: "PUBLISHED" as const, conceptSlug: "vat-rate" }
      const queryDate = new Date("2025-06-15")

      const merged = mergeTemporalFilter(existingWhere, queryDate)

      expect(merged).toHaveProperty("status", "PUBLISHED")
      expect(merged).toHaveProperty("conceptSlug", "vat-rate")
      expect(merged).toHaveProperty("effectiveFrom")
      expect(merged).toHaveProperty("OR")
    })

    it("handles existing OR clause by wrapping in AND", () => {
      const existingWhere = {
        OR: [{ conceptSlug: "vat-rate" }, { conceptSlug: "vat-threshold" }],
        status: "PUBLISHED" as const,
      }
      const queryDate = new Date("2025-06-15")

      const merged = mergeTemporalFilter(existingWhere, queryDate)

      expect(merged).toHaveProperty("AND")
      expect(Array.isArray(merged.AND)).toBe(true)
    })
  })

  describe("getCurrentEffectiveDate", () => {
    it("returns start of today in UTC", () => {
      const result = getCurrentEffectiveDate()

      expect(result.getUTCHours()).toBe(0)
      expect(result.getUTCMinutes()).toBe(0)
      expect(result.getUTCSeconds()).toBe(0)
      expect(result.getUTCMilliseconds()).toBe(0)

      // Should be today's date
      const today = new Date()
      expect(result.getUTCFullYear()).toBe(today.getUTCFullYear())
      expect(result.getUTCMonth()).toBe(today.getUTCMonth())
      expect(result.getUTCDate()).toBe(today.getUTCDate())
    })
  })

  describe("real-world scenarios", () => {
    it("handles VAT rate change scenario (old rate expires, new rate starts)", () => {
      // Scenario: VAT rate changed on 2025-01-01
      // Old rate (12.5%) effective until 2024-12-31 (exclusive: not effective on 2024-12-31)
      // New rate (13%) effective from 2025-01-01
      const oldRate: TemporallyBoundedEntity & { rate: string } = {
        effectiveFrom: new Date("2020-01-01"),
        effectiveUntil: new Date("2025-01-01"), // Exclusive: not effective on 2025-01-01
        rate: "12.5%",
      }
      const newRate: TemporallyBoundedEntity & { rate: string } = {
        effectiveFrom: new Date("2025-01-01"), // Inclusive: effective from 2025-01-01
        effectiveUntil: null,
        rate: "13%",
      }

      // Query for Dec 31, 2024 - old rate should apply
      const dec31 = new Date("2024-12-31")
      expect(isTemporallyEffective(oldRate, dec31).isEffective).toBe(true)
      expect(isTemporallyEffective(newRate, dec31).isEffective).toBe(false)

      // Query for Jan 1, 2025 - new rate should apply
      const jan1 = new Date("2025-01-01")
      expect(isTemporallyEffective(oldRate, jan1).isEffective).toBe(false)
      expect(isTemporallyEffective(newRate, jan1).isEffective).toBe(true)
    })

    it("handles overlapping rules scenario", () => {
      // Scenario: General rule and specific exemption period
      const generalRule: TemporallyBoundedEntity & { name: string } = {
        effectiveFrom: new Date("2020-01-01"),
        effectiveUntil: null,
        name: "General VAT obligation",
      }
      const exemption: TemporallyBoundedEntity & { name: string } = {
        effectiveFrom: new Date("2025-03-01"),
        effectiveUntil: new Date("2025-06-01"), // Exclusive
        name: "COVID exemption",
      }

      const queryDuringExemption = new Date("2025-04-15")
      const queryAfterExemption = new Date("2025-06-01") // On the effectiveUntil date (exclusive)

      // During exemption period - both should match
      expect(isTemporallyEffective(generalRule, queryDuringExemption).isEffective).toBe(true)
      expect(isTemporallyEffective(exemption, queryDuringExemption).isEffective).toBe(true)

      // On effectiveUntil date - exemption should not match (exclusive boundary)
      expect(isTemporallyEffective(generalRule, queryAfterExemption).isEffective).toBe(true)
      expect(isTemporallyEffective(exemption, queryAfterExemption).isEffective).toBe(false)
    })

    it("handles pausalni threshold change scenario", () => {
      // Scenario: Pausalni obrt threshold changed from 39,816.84 EUR to 50,000 EUR
      const oldThreshold: TemporallyBoundedEntity & { value: number } = {
        effectiveFrom: new Date("2023-01-01"),
        effectiveUntil: new Date("2025-01-01"),
        value: 39816.84,
      }
      const newThreshold: TemporallyBoundedEntity & { value: number } = {
        effectiveFrom: new Date("2025-01-01"),
        effectiveUntil: null,
        value: 50000,
      }

      const entities = [oldThreshold, newThreshold]

      // Query in 2024 - old threshold
      const query2024 = new Date("2024-06-15")
      const effective2024 = filterByTemporalEffectiveness(entities, query2024)
      expect(effective2024.length).toBe(1)
      expect(effective2024[0].value).toBe(39816.84)

      // Query in 2025 - new threshold
      const query2025 = new Date("2025-06-15")
      const effective2025 = filterByTemporalEffectiveness(entities, query2025)
      expect(effective2025.length).toBe(1)
      expect(effective2025[0].value).toBe(50000)
    })
  })
})
