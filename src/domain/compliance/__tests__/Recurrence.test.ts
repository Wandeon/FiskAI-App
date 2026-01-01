// src/domain/compliance/__tests__/Recurrence.test.ts
import { describe, it, expect } from "vitest"
import { Recurrence } from "../Recurrence"
import { ComplianceError } from "../ComplianceError"

describe("Recurrence", () => {
  describe("monthly", () => {
    it("creates a monthly recurrence on a valid day", () => {
      const recurrence = Recurrence.monthly(15)
      expect(recurrence.type).toBe("MONTHLY")
      expect(recurrence.dayOfMonth).toBe(15)
      expect(recurrence.isRecurring).toBe(true)
    })

    it("creates a monthly recurrence on day 1", () => {
      const recurrence = Recurrence.monthly(1)
      expect(recurrence.dayOfMonth).toBe(1)
    })

    it("creates a monthly recurrence on day 31", () => {
      const recurrence = Recurrence.monthly(31)
      expect(recurrence.dayOfMonth).toBe(31)
    })

    it("throws for day 0", () => {
      expect(() => Recurrence.monthly(0)).toThrow(ComplianceError)
      expect(() => Recurrence.monthly(0)).toThrow("Day of month must be between 1 and 31")
    })

    it("throws for day 32", () => {
      expect(() => Recurrence.monthly(32)).toThrow(ComplianceError)
      expect(() => Recurrence.monthly(32)).toThrow("Day of month must be between 1 and 31")
    })

    it("throws for negative day", () => {
      expect(() => Recurrence.monthly(-1)).toThrow(ComplianceError)
    })
  })

  describe("quarterly", () => {
    it("creates a quarterly recurrence on a valid day", () => {
      const recurrence = Recurrence.quarterly(20)
      expect(recurrence.type).toBe("QUARTERLY")
      expect(recurrence.dayOfMonth).toBe(20)
      expect(recurrence.isRecurring).toBe(true)
    })

    it("throws for invalid day", () => {
      expect(() => Recurrence.quarterly(0)).toThrow(ComplianceError)
      expect(() => Recurrence.quarterly(32)).toThrow(ComplianceError)
    })
  })

  describe("yearly", () => {
    it("creates a yearly recurrence with valid month and day", () => {
      const recurrence = Recurrence.yearly(3, 15)
      expect(recurrence.type).toBe("YEARLY")
      expect(recurrence.month).toBe(3)
      expect(recurrence.dayOfMonth).toBe(15)
      expect(recurrence.isRecurring).toBe(true)
    })

    it("creates a yearly recurrence for January 1", () => {
      const recurrence = Recurrence.yearly(1, 1)
      expect(recurrence.month).toBe(1)
      expect(recurrence.dayOfMonth).toBe(1)
    })

    it("creates a yearly recurrence for December 31", () => {
      const recurrence = Recurrence.yearly(12, 31)
      expect(recurrence.month).toBe(12)
      expect(recurrence.dayOfMonth).toBe(31)
    })

    it("throws for month 0", () => {
      expect(() => Recurrence.yearly(0, 15)).toThrow(ComplianceError)
      expect(() => Recurrence.yearly(0, 15)).toThrow("Month must be between 1 and 12")
    })

    it("throws for month 13", () => {
      expect(() => Recurrence.yearly(13, 15)).toThrow(ComplianceError)
      expect(() => Recurrence.yearly(13, 15)).toThrow("Month must be between 1 and 12")
    })

    it("throws for invalid day", () => {
      expect(() => Recurrence.yearly(3, 0)).toThrow(ComplianceError)
      expect(() => Recurrence.yearly(3, 32)).toThrow(ComplianceError)
    })
  })

  describe("oneTime", () => {
    it("creates a one-time recurrence on a specific date", () => {
      const date = new Date(2025, 5, 15)
      const recurrence = Recurrence.oneTime(date)
      expect(recurrence.type).toBe("ONE_TIME")
      expect(recurrence.specificDate).toEqual(date)
      expect(recurrence.isRecurring).toBe(false)
    })

    it("clones the input date to prevent mutation", () => {
      const date = new Date(2025, 5, 15)
      const recurrence = Recurrence.oneTime(date)
      date.setFullYear(2030)
      expect(recurrence.specificDate?.getFullYear()).toBe(2025)
    })
  })

  describe("getNextOccurrence", () => {
    describe("ONE_TIME", () => {
      it("returns the specific date", () => {
        const targetDate = new Date(2025, 5, 15)
        const recurrence = Recurrence.oneTime(targetDate)
        const next = recurrence.getNextOccurrence(new Date(2025, 0, 1))
        expect(next).toEqual(targetDate)
      })
    })

    describe("MONTHLY", () => {
      it("returns this month if deadline not passed", () => {
        const recurrence = Recurrence.monthly(20)
        const from = new Date(2025, 2, 10) // March 10
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(2) // March
        expect(next.getDate()).toBe(20)
      })

      it("returns next month if deadline passed", () => {
        const recurrence = Recurrence.monthly(10)
        const from = new Date(2025, 2, 15) // March 15
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(3) // April
        expect(next.getDate()).toBe(10)
      })

      it("returns next month if today is the deadline", () => {
        const recurrence = Recurrence.monthly(15)
        const from = new Date(2025, 2, 15) // March 15
        const next = recurrence.getNextOccurrence(from)
        expect(next.getMonth()).toBe(3) // April
      })

      it("handles month overflow to next year", () => {
        const recurrence = Recurrence.monthly(10)
        const from = new Date(2025, 11, 15) // December 15
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2026)
        expect(next.getMonth()).toBe(0) // January
        expect(next.getDate()).toBe(10)
      })

      it("handles February with day 31 (day overflow)", () => {
        const recurrence = Recurrence.monthly(31)
        const from = new Date(2025, 1, 1) // February 1, 2025
        const next = recurrence.getNextOccurrence(from)
        expect(next.getMonth()).toBe(1) // February
        expect(next.getDate()).toBe(28) // 2025 is not a leap year
      })

      it("handles leap year February with day 29", () => {
        const recurrence = Recurrence.monthly(29)
        const from = new Date(2024, 1, 1) // February 1, 2024 (leap year)
        const next = recurrence.getNextOccurrence(from)
        expect(next.getMonth()).toBe(1) // February
        expect(next.getDate()).toBe(29)
      })
    })

    describe("QUARTERLY", () => {
      it("returns current quarter if deadline not passed (Q1)", () => {
        const recurrence = Recurrence.quarterly(20)
        const from = new Date(2025, 0, 10) // January 10
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(0) // January (Q1)
        expect(next.getDate()).toBe(20)
      })

      it("returns next quarter if deadline passed (Q1 -> Q2)", () => {
        const recurrence = Recurrence.quarterly(10)
        const from = new Date(2025, 0, 15) // January 15
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(3) // April (Q2)
        expect(next.getDate()).toBe(10)
      })

      it("returns next quarter from Q2 to Q3", () => {
        const recurrence = Recurrence.quarterly(15)
        const from = new Date(2025, 4, 1) // May 1 (Q2 past deadline)
        const next = recurrence.getNextOccurrence(from)
        expect(next.getMonth()).toBe(6) // July (Q3)
      })

      it("returns next quarter from Q3 to Q4", () => {
        const recurrence = Recurrence.quarterly(15)
        const from = new Date(2025, 7, 1) // August 1 (Q3 past deadline)
        const next = recurrence.getNextOccurrence(from)
        expect(next.getMonth()).toBe(9) // October (Q4)
      })

      it("returns Q1 of next year from Q4", () => {
        const recurrence = Recurrence.quarterly(10)
        const from = new Date(2025, 9, 15) // October 15 (Q4 past deadline)
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2026)
        expect(next.getMonth()).toBe(0) // January (Q1)
      })
    })

    describe("YEARLY", () => {
      it("returns this year if deadline not passed", () => {
        const recurrence = Recurrence.yearly(6, 15) // June 15
        const from = new Date(2025, 2, 1) // March 1
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(5) // June
        expect(next.getDate()).toBe(15)
      })

      it("returns next year if deadline passed", () => {
        const recurrence = Recurrence.yearly(3, 15) // March 15
        const from = new Date(2025, 5, 1) // June 1
        const next = recurrence.getNextOccurrence(from)
        expect(next.getFullYear()).toBe(2026)
        expect(next.getMonth()).toBe(2) // March
        expect(next.getDate()).toBe(15)
      })

      it("handles leap year February 29", () => {
        const recurrence = Recurrence.yearly(2, 29) // February 29
        const from = new Date(2025, 0, 1) // January 1, 2025 (non-leap year)
        const next = recurrence.getNextOccurrence(from)
        // 2025 is not a leap year, so Feb 29 -> Feb 28
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(1)
        expect(next.getDate()).toBe(28)
      })
    })
  })

  describe("toJSON / fromJSON", () => {
    it("serializes and deserializes MONTHLY recurrence", () => {
      const original = Recurrence.monthly(15)
      const json = original.toJSON()
      const restored = Recurrence.fromJSON(json)
      expect(restored.type).toBe(original.type)
      expect(restored.dayOfMonth).toBe(original.dayOfMonth)
    })

    it("serializes and deserializes QUARTERLY recurrence", () => {
      const original = Recurrence.quarterly(20)
      const json = original.toJSON()
      const restored = Recurrence.fromJSON(json)
      expect(restored.type).toBe(original.type)
      expect(restored.dayOfMonth).toBe(original.dayOfMonth)
    })

    it("serializes and deserializes YEARLY recurrence", () => {
      const original = Recurrence.yearly(6, 15)
      const json = original.toJSON()
      const restored = Recurrence.fromJSON(json)
      expect(restored.type).toBe(original.type)
      expect(restored.month).toBe(original.month)
      expect(restored.dayOfMonth).toBe(original.dayOfMonth)
    })

    it("serializes and deserializes ONE_TIME recurrence", () => {
      const date = new Date(2025, 5, 15, 12, 0, 0)
      const original = Recurrence.oneTime(date)
      const json = original.toJSON()
      const restored = Recurrence.fromJSON(json)
      expect(restored.type).toBe(original.type)
      expect(restored.specificDate?.getTime()).toBe(date.getTime())
    })
  })
})
