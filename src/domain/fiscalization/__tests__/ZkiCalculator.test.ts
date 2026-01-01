import { describe, it, expect } from "vitest"
import { Money } from "@/domain/shared"
import {
  buildZkiString,
  validateOib,
  formatZkiDateTime,
  formatZkiAmount,
  type ZkiInput,
} from "../ZkiCalculator"
import { FiscalError } from "../FiscalError"

describe("ZkiCalculator", () => {
  describe("buildZkiString", () => {
    it("formats correctly per Croatian fiscalization spec", () => {
      const input: ZkiInput = {
        oib: "12345678901",
        invoiceNumber: "43-1-1",
        totalAmount: Money.fromString("125.00"),
        issueDateTime: new Date(2024, 0, 15, 10, 30, 45), // 15.01.2024 10:30:45
      }

      const result = buildZkiString(input)

      expect(result).toBe("1234567890115.01.2024 10:30:4543-1-1125,00")
    })

    it("handles different amounts", () => {
      const input: ZkiInput = {
        oib: "12345678901",
        invoiceNumber: "1-1-1",
        totalAmount: Money.fromString("1234.56"),
        issueDateTime: new Date(2024, 5, 20, 14, 0, 0),
      }

      const result = buildZkiString(input)

      expect(result).toBe("1234567890120.06.2024 14:00:001-1-11234,56")
    })

    it("handles zero amount", () => {
      const input: ZkiInput = {
        oib: "12345678901",
        invoiceNumber: "1-1-1",
        totalAmount: Money.zero(),
        issueDateTime: new Date(2024, 0, 1, 0, 0, 0),
      }

      const result = buildZkiString(input)

      expect(result).toBe("1234567890101.01.2024 00:00:001-1-10,00")
    })

    it("throws on invalid OIB", () => {
      const input: ZkiInput = {
        oib: "1234567890", // Only 10 digits
        invoiceNumber: "1-1-1",
        totalAmount: Money.fromString("100.00"),
        issueDateTime: new Date(2024, 0, 1, 0, 0, 0),
      }

      expect(() => buildZkiString(input)).toThrow(FiscalError)
      expect(() => buildZkiString(input)).toThrow("OIB must be exactly 11 digits")
    })
  })

  describe("validateOib", () => {
    it("accepts valid 11-digit OIB", () => {
      expect(() => validateOib("12345678901")).not.toThrow()
      expect(() => validateOib("00000000000")).not.toThrow()
      expect(() => validateOib("99999999999")).not.toThrow()
    })

    it("throws on OIB with less than 11 digits", () => {
      expect(() => validateOib("1234567890")).toThrow(FiscalError)
      expect(() => validateOib("1234567890")).toThrow("OIB must be exactly 11 digits")
    })

    it("throws on OIB with more than 11 digits", () => {
      expect(() => validateOib("123456789012")).toThrow(FiscalError)
      expect(() => validateOib("123456789012")).toThrow("OIB must be exactly 11 digits")
    })

    it("throws on OIB with non-digits", () => {
      expect(() => validateOib("1234567890A")).toThrow(FiscalError)
      expect(() => validateOib("1234567890A")).toThrow("OIB must be exactly 11 digits")
    })

    it("throws on empty string", () => {
      expect(() => validateOib("")).toThrow(FiscalError)
    })

    it("throws on OIB with spaces", () => {
      expect(() => validateOib("1234 567890")).toThrow(FiscalError)
    })
  })

  describe("formatZkiDateTime", () => {
    it("formats date as DD.MM.YYYY HH:MM:SS", () => {
      const date = new Date(2024, 0, 15, 10, 30, 45)
      expect(formatZkiDateTime(date)).toBe("15.01.2024 10:30:45")
    })

    it("pads single-digit day and month", () => {
      const date = new Date(2024, 0, 5, 1, 2, 3)
      expect(formatZkiDateTime(date)).toBe("05.01.2024 01:02:03")
    })

    it("handles midnight", () => {
      const date = new Date(2024, 11, 31, 0, 0, 0)
      expect(formatZkiDateTime(date)).toBe("31.12.2024 00:00:00")
    })

    it("handles end of day", () => {
      const date = new Date(2024, 6, 4, 23, 59, 59)
      expect(formatZkiDateTime(date)).toBe("04.07.2024 23:59:59")
    })
  })

  describe("formatZkiAmount", () => {
    it("formats with comma as decimal separator", () => {
      const amount = Money.fromString("125.00")
      expect(formatZkiAmount(amount)).toBe("125,00")
    })

    it("formats cents correctly", () => {
      const amount = Money.fromString("125.50")
      expect(formatZkiAmount(amount)).toBe("125,50")
    })

    it("handles large amounts without thousands separator", () => {
      const amount = Money.fromString("12345.67")
      expect(formatZkiAmount(amount)).toBe("12345,67")
    })

    it("formats zero amount", () => {
      const amount = Money.zero()
      expect(formatZkiAmount(amount)).toBe("0,00")
    })

    it("formats single cent", () => {
      const amount = Money.fromString("0.01")
      expect(formatZkiAmount(amount)).toBe("0,01")
    })

    it("handles negative amounts", () => {
      const amount = Money.fromString("-100.00")
      expect(formatZkiAmount(amount)).toBe("-100,00")
    })
  })
})
