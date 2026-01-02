import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { InvoiceNumber } from "../InvoiceNumber"
import { InvoiceError } from "../InvoiceError"

describe("InvoiceNumber", () => {
  describe("creation", () => {
    it("creates with valid positive numbers", () => {
      const invoiceNumber = InvoiceNumber.create(43, 1, 1, 2024)
      expect(invoiceNumber.sequenceNumber).toBe(43)
      expect(invoiceNumber.premiseCode).toBe(1)
      expect(invoiceNumber.deviceCode).toBe(1)
      expect(invoiceNumber.year).toBe(2024)
    })

    it("creates with large sequence numbers", () => {
      const invoiceNumber = InvoiceNumber.create(9999, 5, 3, 2025)
      expect(invoiceNumber.sequenceNumber).toBe(9999)
      expect(invoiceNumber.premiseCode).toBe(5)
      expect(invoiceNumber.deviceCode).toBe(3)
    })
  })

  describe("validation", () => {
    it("throws on zero sequence number", () => {
      expect(() => InvoiceNumber.create(0, 1, 1, 2024)).toThrow(InvoiceError)
      expect(() => InvoiceNumber.create(0, 1, 1, 2024)).toThrow("Sequence number must be positive")
    })

    it("throws on negative sequence number", () => {
      expect(() => InvoiceNumber.create(-1, 1, 1, 2024)).toThrow(InvoiceError)
      expect(() => InvoiceNumber.create(-1, 1, 1, 2024)).toThrow("Sequence number must be positive")
    })

    it("throws on zero premise code", () => {
      expect(() => InvoiceNumber.create(1, 0, 1, 2024)).toThrow(InvoiceError)
      expect(() => InvoiceNumber.create(1, 0, 1, 2024)).toThrow("Premise code must be positive")
    })

    it("throws on negative premise code", () => {
      expect(() => InvoiceNumber.create(1, -1, 1, 2024)).toThrow(InvoiceError)
      expect(() => InvoiceNumber.create(1, -1, 1, 2024)).toThrow("Premise code must be positive")
    })

    it("throws on zero device code", () => {
      expect(() => InvoiceNumber.create(1, 1, 0, 2024)).toThrow(InvoiceError)
      expect(() => InvoiceNumber.create(1, 1, 0, 2024)).toThrow("Device code must be positive")
    })

    it("throws on negative device code", () => {
      expect(() => InvoiceNumber.create(1, 1, -1, 2024)).toThrow(InvoiceError)
      expect(() => InvoiceNumber.create(1, 1, -1, 2024)).toThrow("Device code must be positive")
    })
  })

  describe("parse", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 5, 15)) // June 15, 2024
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("parses valid format 43-1-1", () => {
      const invoiceNumber = InvoiceNumber.parse("43-1-1")
      expect(invoiceNumber.sequenceNumber).toBe(43)
      expect(invoiceNumber.premiseCode).toBe(1)
      expect(invoiceNumber.deviceCode).toBe(1)
      expect(invoiceNumber.year).toBe(2024)
    })

    it("parses valid format with larger numbers", () => {
      const invoiceNumber = InvoiceNumber.parse("123-4-5")
      expect(invoiceNumber.sequenceNumber).toBe(123)
      expect(invoiceNumber.premiseCode).toBe(4)
      expect(invoiceNumber.deviceCode).toBe(5)
    })

    it("parses format with leading zeros", () => {
      const invoiceNumber = InvoiceNumber.parse("001-001-001")
      expect(invoiceNumber.sequenceNumber).toBe(1)
      expect(invoiceNumber.premiseCode).toBe(1)
      expect(invoiceNumber.deviceCode).toBe(1)
    })

    it("throws on invalid format - missing parts", () => {
      expect(() => InvoiceNumber.parse("43-1")).toThrow(InvoiceError)
      expect(() => InvoiceNumber.parse("43-1")).toThrow("Invalid invoice number format: 43-1")
    })

    it("throws on invalid format - too many parts", () => {
      expect(() => InvoiceNumber.parse("43-1-1-1")).toThrow(InvoiceError)
      expect(() => InvoiceNumber.parse("43-1-1-1")).toThrow(
        "Invalid invoice number format: 43-1-1-1"
      )
    })

    it("throws on invalid format - non-numeric", () => {
      expect(() => InvoiceNumber.parse("abc-1-1")).toThrow(InvoiceError)
      expect(() => InvoiceNumber.parse("43-x-1")).toThrow(InvoiceError)
    })

    it("throws on invalid format - empty string", () => {
      expect(() => InvoiceNumber.parse("")).toThrow(InvoiceError)
    })

    it("throws on invalid format - wrong separator", () => {
      expect(() => InvoiceNumber.parse("43/1/1")).toThrow(InvoiceError)
      expect(() => InvoiceNumber.parse("43_1_1")).toThrow(InvoiceError)
    })

    it("uses explicit year option", () => {
      const invoiceNumber = InvoiceNumber.parse("43-1-1", { year: 2022 })
      expect(invoiceNumber.year).toBe(2022)
    })

    it("infers year from date option", () => {
      const historicalDate = new Date(2021, 3, 15) // April 15, 2021
      const invoiceNumber = InvoiceNumber.parse("43-1-1", { inferFromDate: historicalDate })
      expect(invoiceNumber.year).toBe(2021)
    })

    it("explicit year takes precedence over inferFromDate", () => {
      const historicalDate = new Date(2021, 3, 15) // April 15, 2021
      const invoiceNumber = InvoiceNumber.parse("43-1-1", {
        year: 2019,
        inferFromDate: historicalDate,
      })
      expect(invoiceNumber.year).toBe(2019)
    })

    it("defaults to current year when no options provided", () => {
      const invoiceNumber = InvoiceNumber.parse("43-1-1")
      expect(invoiceNumber.year).toBe(2024) // Mocked system time
    })

    it("defaults to current year when empty options provided", () => {
      const invoiceNumber = InvoiceNumber.parse("43-1-1", {})
      expect(invoiceNumber.year).toBe(2024) // Mocked system time
    })
  })

  describe("format", () => {
    it("formats as broj-prostor-uredaj", () => {
      const invoiceNumber = InvoiceNumber.create(43, 1, 1, 2024)
      expect(invoiceNumber.format()).toBe("43-1-1")
    })

    it("formats with larger numbers", () => {
      const invoiceNumber = InvoiceNumber.create(999, 12, 8, 2024)
      expect(invoiceNumber.format()).toBe("999-12-8")
    })

    it("formats single digit numbers without padding", () => {
      const invoiceNumber = InvoiceNumber.create(1, 1, 1, 2024)
      expect(invoiceNumber.format()).toBe("1-1-1")
    })
  })

  describe("formatWithYear", () => {
    it("formats with year suffix", () => {
      const invoiceNumber = InvoiceNumber.create(43, 1, 1, 2024)
      expect(invoiceNumber.formatWithYear()).toBe("43-1-1/2024")
    })

    it("formats different years correctly", () => {
      const invoiceNumber = InvoiceNumber.create(100, 2, 3, 2025)
      expect(invoiceNumber.formatWithYear()).toBe("100-2-3/2025")
    })
  })

  describe("round-trip", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2024, 0, 1))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("parse and format are consistent", () => {
      const original = "43-1-1"
      const parsed = InvoiceNumber.parse(original)
      expect(parsed.format()).toBe(original)
    })

    it("create and format are consistent", () => {
      const invoiceNumber = InvoiceNumber.create(123, 4, 5, 2024)
      const formatted = invoiceNumber.format()
      const parsed = InvoiceNumber.parse(formatted)
      expect(parsed.sequenceNumber).toBe(invoiceNumber.sequenceNumber)
      expect(parsed.premiseCode).toBe(invoiceNumber.premiseCode)
      expect(parsed.deviceCode).toBe(invoiceNumber.deviceCode)
    })
  })
})
