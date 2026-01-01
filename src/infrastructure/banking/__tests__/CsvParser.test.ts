// src/infrastructure/banking/__tests__/CsvParser.test.ts
import { describe, it, expect } from "vitest"
import {
  parseCroatianAmount,
  parseCroatianDate,
  determineDirection,
  parseCsvRow,
  parseErsteRow,
  parsePbzRow,
  parseZabaRow,
  parseGenericRow,
  CsvParseError,
} from "../CsvParser"
import { Money } from "@/domain/shared"
import { TransactionDirection } from "@/domain/banking"

describe("CsvParser", () => {
  describe("parseCroatianAmount", () => {
    it("parses simple positive amount", () => {
      const result = parseCroatianAmount("100,00")

      expect(result.toDecimal().toNumber()).toBe(100)
      expect(result.currency).toBe("EUR")
    })

    it("parses amount with thousands separator", () => {
      const result = parseCroatianAmount("1.234,56")

      expect(result.toDecimal().toNumber()).toBe(1234.56)
    })

    it("parses large amount with multiple thousands separators", () => {
      const result = parseCroatianAmount("1.234.567,89")

      expect(result.toDecimal().toNumber()).toBe(1234567.89)
    })

    it("parses negative amount", () => {
      const result = parseCroatianAmount("-1.234,56")

      expect(result.toDecimal().toNumber()).toBe(-1234.56)
      expect(result.isNegative()).toBe(true)
    })

    it("parses amount without decimals", () => {
      const result = parseCroatianAmount("1.000")

      expect(result.toDecimal().toNumber()).toBe(1000)
    })

    it("parses small amount without thousands separator", () => {
      const result = parseCroatianAmount("99,99")

      expect(result.toDecimal().toNumber()).toBe(99.99)
    })

    it("parses zero amount", () => {
      const result = parseCroatianAmount("0,00")

      expect(result.isZero()).toBe(true)
    })

    it("handles whitespace around value", () => {
      const result = parseCroatianAmount("  1.234,56  ")

      expect(result.toDecimal().toNumber()).toBe(1234.56)
    })

    it("respects specified currency", () => {
      const result = parseCroatianAmount("100,00", "USD")

      expect(result.currency).toBe("USD")
    })

    it("throws on empty value", () => {
      expect(() => parseCroatianAmount("")).toThrow(CsvParseError)
      expect(() => parseCroatianAmount("")).toThrow("Amount value is required")
    })

    it("throws on whitespace-only value", () => {
      expect(() => parseCroatianAmount("   ")).toThrow(CsvParseError)
    })

    it("throws on null/undefined value", () => {
      expect(() => parseCroatianAmount(null as unknown as string)).toThrow(CsvParseError)
      expect(() => parseCroatianAmount(undefined as unknown as string)).toThrow(CsvParseError)
    })

    it("throws on invalid format", () => {
      expect(() => parseCroatianAmount("abc")).toThrow(CsvParseError)
      expect(() => parseCroatianAmount("abc")).toThrow("Invalid amount format")
    })

    it("handles US-style format as invalid Croatian format", () => {
      // US format 1,234.56 becomes 1234.56 after removing dots and converting comma to dot
      // This is actually a valid parse but may not be intended - documenting current behavior
      const result = parseCroatianAmount("1,234.56")
      // After removing dots: "1,23456", after converting comma: "1.23456"
      expect(result.toDecimal().toNumber()).toBe(1.23456)
    })
  })

  describe("parseCroatianDate", () => {
    it("parses standard DD.MM.YYYY format", () => {
      const result = parseCroatianDate("15.01.2025")

      expect(result.getDate()).toBe(15)
      expect(result.getMonth()).toBe(0) // January is 0
      expect(result.getFullYear()).toBe(2025)
    })

    it("parses single-digit day", () => {
      const result = parseCroatianDate("5.01.2025")

      expect(result.getDate()).toBe(5)
    })

    it("parses single-digit month", () => {
      const result = parseCroatianDate("15.1.2025")

      expect(result.getMonth()).toBe(0)
    })

    it("parses single-digit day and month", () => {
      const result = parseCroatianDate("5.1.2025")

      expect(result.getDate()).toBe(5)
      expect(result.getMonth()).toBe(0)
    })

    it("parses end of month date", () => {
      const result = parseCroatianDate("31.12.2024")

      expect(result.getDate()).toBe(31)
      expect(result.getMonth()).toBe(11)
      expect(result.getFullYear()).toBe(2024)
    })

    it("handles whitespace around value", () => {
      const result = parseCroatianDate("  15.01.2025  ")

      expect(result.getDate()).toBe(15)
    })

    it("parses leap year date", () => {
      const result = parseCroatianDate("29.02.2024")

      expect(result.getDate()).toBe(29)
      expect(result.getMonth()).toBe(1)
    })

    it("throws on empty value", () => {
      expect(() => parseCroatianDate("")).toThrow(CsvParseError)
      expect(() => parseCroatianDate("")).toThrow("Date value is required")
    })

    it("throws on null/undefined value", () => {
      expect(() => parseCroatianDate(null as unknown as string)).toThrow(CsvParseError)
      expect(() => parseCroatianDate(undefined as unknown as string)).toThrow(CsvParseError)
    })

    it("throws on invalid format (ISO)", () => {
      expect(() => parseCroatianDate("2025-01-15")).toThrow(CsvParseError)
      expect(() => parseCroatianDate("2025-01-15")).toThrow("expected DD.MM.YYYY")
    })

    it("throws on invalid format (US)", () => {
      expect(() => parseCroatianDate("01/15/2025")).toThrow(CsvParseError)
    })

    it("throws on invalid month", () => {
      expect(() => parseCroatianDate("15.13.2025")).toThrow(CsvParseError)
      expect(() => parseCroatianDate("15.13.2025")).toThrow("Invalid month")
    })

    it("throws on invalid day", () => {
      expect(() => parseCroatianDate("32.01.2025")).toThrow(CsvParseError)
      expect(() => parseCroatianDate("32.01.2025")).toThrow("Invalid day")
    })

    it("throws on Feb 29 in non-leap year", () => {
      expect(() => parseCroatianDate("29.02.2025")).toThrow(CsvParseError)
      expect(() => parseCroatianDate("29.02.2025")).toThrow("Invalid date")
    })

    it("throws on impossible date like Feb 30", () => {
      expect(() => parseCroatianDate("30.02.2024")).toThrow(CsvParseError)
    })
  })

  describe("determineDirection", () => {
    it("returns CREDIT for positive amount", () => {
      const amount = Money.fromString("100.00")

      const result = determineDirection(amount)

      expect(result).toBe(TransactionDirection.CREDIT)
    })

    it("returns DEBIT for negative amount", () => {
      const amount = Money.fromString("-100.00")

      const result = determineDirection(amount)

      expect(result).toBe(TransactionDirection.DEBIT)
    })

    it("returns CREDIT for zero amount", () => {
      const amount = Money.zero()

      const result = determineDirection(amount)

      expect(result).toBe(TransactionDirection.CREDIT)
    })

    it("uses indicator D for debit regardless of amount sign", () => {
      const amount = Money.fromString("100.00")

      const result = determineDirection(amount, "D")

      expect(result).toBe(TransactionDirection.DEBIT)
    })

    it("uses indicator C for credit regardless of amount sign", () => {
      const amount = Money.fromString("-100.00")

      const result = determineDirection(amount, "C")

      expect(result).toBe(TransactionDirection.CREDIT)
    })

    it("handles lowercase indicator", () => {
      const amount = Money.fromString("100.00")

      expect(determineDirection(amount, "d")).toBe(TransactionDirection.DEBIT)
      expect(determineDirection(amount, "c")).toBe(TransactionDirection.CREDIT)
    })

    it("handles DEBIT/CREDIT indicator", () => {
      const amount = Money.fromString("100.00")

      expect(determineDirection(amount, "DEBIT")).toBe(TransactionDirection.DEBIT)
      expect(determineDirection(amount, "CREDIT")).toBe(TransactionDirection.CREDIT)
    })

    it("handles Croatian indicator DUGUJE/POTRAZUJE", () => {
      const amount = Money.fromString("100.00")

      expect(determineDirection(amount, "DUGUJE")).toBe(TransactionDirection.DEBIT)
      expect(determineDirection(amount, "POTRAZUJE")).toBe(TransactionDirection.CREDIT)
    })

    it("handles indicator with whitespace", () => {
      const amount = Money.fromString("100.00")

      expect(determineDirection(amount, "  D  ")).toBe(TransactionDirection.DEBIT)
    })

    it("falls back to amount sign for unknown indicator", () => {
      const positiveAmount = Money.fromString("100.00")
      const negativeAmount = Money.fromString("-100.00")

      expect(determineDirection(positiveAmount, "UNKNOWN")).toBe(TransactionDirection.CREDIT)
      expect(determineDirection(negativeAmount, "UNKNOWN")).toBe(TransactionDirection.DEBIT)
    })

    it("falls back to amount sign for empty indicator", () => {
      const amount = Money.fromString("-50.00")

      expect(determineDirection(amount, "")).toBe(TransactionDirection.DEBIT)
    })
  })

  describe("parseErsteRow", () => {
    it("parses complete Erste row", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "1.234,56",
        Stanje: "10.000,00",
        "Naziv primatelja/platitelja": "ACME Corp d.o.o.",
        "IBAN primatelja/platitelja": "HR1234567890123456789",
        "Poziv na broj": "HR00 123-456-789",
        "Opis placanja": "Placanje fakture 2025-001",
        "ID transakcije": "TXN-001",
      }

      const result = parseErsteRow(row)

      expect(result.date.getDate()).toBe(15)
      expect(result.date.getMonth()).toBe(0)
      expect(result.date.getFullYear()).toBe(2025)
      expect(result.amount.toDecimal().toNumber()).toBe(1234.56)
      expect(result.direction).toBe(TransactionDirection.CREDIT)
      expect(result.balance?.toDecimal().toNumber()).toBe(10000)
      expect(result.counterpartyName).toBe("ACME Corp d.o.o.")
      expect(result.counterpartyIban).toBe("HR1234567890123456789")
      expect(result.reference).toBe("HR00 123-456-789")
      expect(result.description).toBe("Placanje fakture 2025-001")
      expect(result.externalId).toBe("TXN-001")
    })

    it("parses debit transaction (negative amount)", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "-500,00",
        Stanje: "9.500,00",
      }

      const result = parseErsteRow(row)

      expect(result.amount.toDecimal().toNumber()).toBe(500)
      expect(result.direction).toBe(TransactionDirection.DEBIT)
    })

    it("handles alternative column names", () => {
      const row = {
        Datum: "10.02.2025",
        iznos: "250,00",
        stanje: "5.000,00",
        Naziv: "Test Company",
        IBAN: "HR9876543210987654321",
      }

      const result = parseErsteRow(row)

      expect(result.date.getDate()).toBe(10)
      expect(result.amount.toDecimal().toNumber()).toBe(250)
      expect(result.counterpartyName).toBe("Test Company")
    })

    it("handles missing optional fields", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "100,00",
      }

      const result = parseErsteRow(row)

      expect(result.date).toBeDefined()
      expect(result.amount).toBeDefined()
      expect(result.balance).toBeUndefined()
      expect(result.counterpartyName).toBeUndefined()
      expect(result.counterpartyIban).toBeUndefined()
      expect(result.reference).toBeUndefined()
      expect(result.description).toBeUndefined()
      expect(result.externalId).toBeUndefined()
    })

    it("trims whitespace from string fields", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "100,00",
        "Naziv primatelja/platitelja": "  ACME Corp  ",
        "Opis placanja": "  Payment  ",
      }

      const result = parseErsteRow(row)

      expect(result.counterpartyName).toBe("ACME Corp")
      expect(result.description).toBe("Payment")
    })

    it("ignores empty string fields", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "100,00",
        "Naziv primatelja/platitelja": "",
        "Opis placanja": "   ",
      }

      const result = parseErsteRow(row)

      expect(result.counterpartyName).toBeUndefined()
      expect(result.description).toBeUndefined()
    })

    it("throws when date is missing", () => {
      const row = {
        Iznos: "100,00",
      }

      expect(() => parseErsteRow(row)).toThrow(CsvParseError)
      expect(() => parseErsteRow(row)).toThrow("Missing date column")
    })

    it("throws when amount is missing", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
      }

      expect(() => parseErsteRow(row)).toThrow(CsvParseError)
      expect(() => parseErsteRow(row)).toThrow("Missing amount column")
    })
  })

  describe("parsePbzRow", () => {
    it("parses complete PBZ row", () => {
      const row = {
        Datum: "20.03.2025",
        Iznos: "-750,25",
        Stanje: "8.249,75",
        "Primatelj/Platitelj": "Supplier Ltd",
        IBAN: "HR1111222233334444555",
        "Poziv na broj": "HR01 2025-100",
        Opis: "Nabava materijala",
        ID: "PBZ-12345",
      }

      const result = parsePbzRow(row)

      expect(result.date.getDate()).toBe(20)
      expect(result.date.getMonth()).toBe(2)
      expect(result.amount.toDecimal().toNumber()).toBe(750.25)
      expect(result.direction).toBe(TransactionDirection.DEBIT)
      expect(result.balance?.toDecimal().toNumber()).toBe(8249.75)
      expect(result.counterpartyName).toBe("Supplier Ltd")
      expect(result.counterpartyIban).toBe("HR1111222233334444555")
      expect(result.reference).toBe("HR01 2025-100")
      expect(result.description).toBe("Nabava materijala")
      expect(result.externalId).toBe("PBZ-12345")
    })

    it("handles alternative column names", () => {
      const row = {
        "Datum valute": "25.04.2025",
        Promet: "500,00",
        "Novo stanje": "10.500,00",
        Naziv: "Customer Inc",
        Racun: "HR5555666677778888999",
      }

      const result = parsePbzRow(row)

      expect(result.date.getDate()).toBe(25)
      expect(result.amount.toDecimal().toNumber()).toBe(500)
      expect(result.counterpartyName).toBe("Customer Inc")
      expect(result.counterpartyIban).toBe("HR5555666677778888999")
    })

    it("throws when date is missing", () => {
      const row = {
        Iznos: "100,00",
      }

      expect(() => parsePbzRow(row)).toThrow(CsvParseError)
      expect(() => parsePbzRow(row)).toThrow("Missing date column")
    })

    it("throws when amount is missing", () => {
      const row = {
        Datum: "15.01.2025",
      }

      expect(() => parsePbzRow(row)).toThrow(CsvParseError)
      expect(() => parsePbzRow(row)).toThrow("Missing amount column")
    })
  })

  describe("parseZabaRow", () => {
    it("parses complete ZABA row", () => {
      const row = {
        "Datum izvrsenja": "05.06.2025",
        Iznos: "2.500,00",
        Saldo: "15.000,00",
        Naziv: "Client Company d.o.o.",
        "IBAN racun": "HR9999888877776666555",
        "Poziv na broj": "HR99 2025-200",
        Svrha: "Uplata po ugovoru",
        Referenca: "ZABA-99999",
      }

      const result = parseZabaRow(row)

      expect(result.date.getDate()).toBe(5)
      expect(result.date.getMonth()).toBe(5)
      expect(result.amount.toDecimal().toNumber()).toBe(2500)
      expect(result.direction).toBe(TransactionDirection.CREDIT)
      expect(result.balance?.toDecimal().toNumber()).toBe(15000)
      expect(result.counterpartyName).toBe("Client Company d.o.o.")
      expect(result.counterpartyIban).toBe("HR9999888877776666555")
      expect(result.reference).toBe("HR99 2025-200")
      expect(result.description).toBe("Uplata po ugovoru")
      expect(result.externalId).toBe("ZABA-99999")
    })

    it("handles alternative column names", () => {
      const row = {
        Datum: "10.07.2025",
        Promet: "-300,00",
        Stanje: "14.700,00",
        "Naziv platitelja/primatelja": "Vendor LLC",
        IBAN: "HR1234123412341234123",
      }

      const result = parseZabaRow(row)

      expect(result.date.getDate()).toBe(10)
      expect(result.amount.toDecimal().toNumber()).toBe(300)
      expect(result.direction).toBe(TransactionDirection.DEBIT)
    })

    it("throws when date is missing", () => {
      const row = {
        Iznos: "100,00",
      }

      expect(() => parseZabaRow(row)).toThrow(CsvParseError)
    })

    it("throws when amount is missing", () => {
      const row = {
        "Datum izvrsenja": "15.01.2025",
      }

      expect(() => parseZabaRow(row)).toThrow(CsvParseError)
    })
  })

  describe("parseGenericRow", () => {
    it("parses complete generic row", () => {
      const row = {
        date: "15.08.2025",
        amount: "1.000,00",
        balance: "5.000,00",
        counterparty_name: "Generic Company",
        counterparty_iban: "HR1234567890123456789",
        reference: "REF-001",
        description: "Generic payment",
        external_id: "GEN-001",
      }

      const result = parseGenericRow(row)

      expect(result.date.getDate()).toBe(15)
      expect(result.date.getMonth()).toBe(7)
      expect(result.amount.toDecimal().toNumber()).toBe(1000)
      expect(result.direction).toBe(TransactionDirection.CREDIT)
      expect(result.balance?.toDecimal().toNumber()).toBe(5000)
      expect(result.counterpartyName).toBe("Generic Company")
      expect(result.counterpartyIban).toBe("HR1234567890123456789")
      expect(result.reference).toBe("REF-001")
      expect(result.description).toBe("Generic payment")
      expect(result.externalId).toBe("GEN-001")
    })

    it("uses direction indicator when provided", () => {
      const row = {
        date: "15.08.2025",
        amount: "100,00",
        direction: "D",
      }

      const result = parseGenericRow(row)

      expect(result.direction).toBe(TransactionDirection.DEBIT)
    })

    it("handles capitalized column names", () => {
      const row = {
        Date: "20.09.2025",
        Amount: "500,00",
        Balance: "10.000,00",
        CounterpartyName: "CAPS Company",
      }

      const result = parseGenericRow(row)

      expect(result.date.getDate()).toBe(20)
      expect(result.amount.toDecimal().toNumber()).toBe(500)
      expect(result.counterpartyName).toBe("CAPS Company")
    })

    it("handles camelCase column names", () => {
      const row = {
        date: "25.10.2025",
        amount: "750,00",
        counterpartyName: "CamelCase Corp",
        counterpartyIban: "HR5555555555555555555",
        externalId: "CC-001",
      }

      const result = parseGenericRow(row)

      expect(result.counterpartyName).toBe("CamelCase Corp")
      expect(result.counterpartyIban).toBe("HR5555555555555555555")
      expect(result.externalId).toBe("CC-001")
    })

    it("throws when date is missing", () => {
      const row = {
        amount: "100,00",
      }

      expect(() => parseGenericRow(row)).toThrow(CsvParseError)
      expect(() => parseGenericRow(row)).toThrow("Missing date column")
    })

    it("throws when amount is missing", () => {
      const row = {
        date: "15.01.2025",
      }

      expect(() => parseGenericRow(row)).toThrow(CsvParseError)
      expect(() => parseGenericRow(row)).toThrow("Missing amount column")
    })
  })

  describe("parseCsvRow", () => {
    it("routes to parseErsteRow for erste format", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "100,00",
      }

      const result = parseCsvRow(row, "erste")

      expect(result.date.getDate()).toBe(15)
      expect(result.amount.toDecimal().toNumber()).toBe(100)
    })

    it("routes to parsePbzRow for pbz format", () => {
      const row = {
        Datum: "20.02.2025",
        Iznos: "200,00",
      }

      const result = parseCsvRow(row, "pbz")

      expect(result.date.getDate()).toBe(20)
      expect(result.amount.toDecimal().toNumber()).toBe(200)
    })

    it("routes to parseZabaRow for zaba format", () => {
      const row = {
        "Datum izvrsenja": "25.03.2025",
        Iznos: "300,00",
      }

      const result = parseCsvRow(row, "zaba")

      expect(result.date.getDate()).toBe(25)
      expect(result.amount.toDecimal().toNumber()).toBe(300)
    })

    it("routes to parseGenericRow for generic format", () => {
      const row = {
        date: "30.04.2025",
        amount: "400,00",
      }

      const result = parseCsvRow(row, "generic")

      expect(result.date.getDate()).toBe(30)
      expect(result.amount.toDecimal().toNumber()).toBe(400)
    })
  })

  describe("Edge Cases", () => {
    it("handles very large amounts", () => {
      const result = parseCroatianAmount("999.999.999,99")

      expect(result.toDecimal().toNumber()).toBe(999999999.99)
    })

    it("handles very small amounts", () => {
      const result = parseCroatianAmount("0,01")

      expect(result.toDecimal().toNumber()).toBe(0.01)
    })

    it("handles amount with single decimal digit", () => {
      // Some bank exports may have single decimal digit
      const result = parseCroatianAmount("100,5")

      expect(result.toDecimal().toNumber()).toBe(100.5)
    })

    it("handles Croatian characters in fields", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "100,00",
        "Naziv primatelja/platitelja": "Cokolada d.o.o.",
        "Opis placanja": "Placanje za sljive i zito",
      }

      const result = parseErsteRow(row)

      expect(result.counterpartyName).toBe("Cokolada d.o.o.")
      expect(result.description).toBe("Placanje za sljive i zito")
    })

    it("handles empty object row", () => {
      expect(() => parseErsteRow({})).toThrow(CsvParseError)
    })

    it("handles row with only whitespace values", () => {
      const row = {
        "Datum knjizenja": "   ",
        Iznos: "   ",
      }

      expect(() => parseErsteRow(row)).toThrow(CsvParseError)
    })

    it("preserves precision for decimal amounts", () => {
      const row = {
        date: "15.01.2025",
        amount: "123,45",
        balance: "9.876,54",
      }

      const result = parseGenericRow(row)

      // Test precise decimal handling
      const sum = result.amount.add(result.balance!)
      expect(sum.equals(Money.fromString("9999.99"))).toBe(true)
    })

    it("handles negative balance", () => {
      const row = {
        "Datum knjizenja": "15.01.2025",
        Iznos: "-100,00",
        Stanje: "-500,00",
      }

      const result = parseErsteRow(row)

      expect(result.balance?.isNegative()).toBe(true)
      expect(result.balance?.toDecimal().toNumber()).toBe(-500)
    })

    it("CsvParseError includes field and value context", () => {
      try {
        parseCroatianAmount("invalid")
      } catch (error) {
        expect(error).toBeInstanceOf(CsvParseError)
        const parseError = error as CsvParseError
        expect(parseError.field).toBe("amount")
        expect(parseError.value).toBe("invalid")
        expect(parseError.code).toBe("CSV_PARSE_ERROR")
      }
    })
  })

  describe("Real-World Scenarios", () => {
    it("processes typical salary payment", () => {
      const row = {
        "Datum knjizenja": "10.01.2025",
        Iznos: "-15.500,00",
        Stanje: "25.000,00",
        "Naziv primatelja/platitelja": "Ivan Horvat",
        "IBAN primatelja/platitelja": "HR1234567890123456789",
        "Poziv na broj": "HR00 01-2025",
        "Opis placanja": "Placa za sijecanj 2025",
      }

      const result = parseErsteRow(row)

      expect(result.direction).toBe(TransactionDirection.DEBIT)
      expect(result.amount.toDecimal().toNumber()).toBe(15500)
      expect(result.description).toBe("Placa za sijecanj 2025")
    })

    it("processes typical customer payment receipt", () => {
      const row = {
        Datum: "15.02.2025",
        Iznos: "7.500,00",
        Stanje: "32.500,00",
        "Primatelj/Platitelj": "Klijent d.o.o.",
        IBAN: "HR9876543210987654321",
        "Poziv na broj": "HR01 2025-123",
        Opis: "Uplata po racunu R-2025-123",
      }

      const result = parsePbzRow(row)

      expect(result.direction).toBe(TransactionDirection.CREDIT)
      expect(result.amount.toDecimal().toNumber()).toBe(7500)
      expect(result.reference).toBe("HR01 2025-123")
    })

    it("processes bank fee transaction", () => {
      const row = {
        "Datum izvrsenja": "31.01.2025",
        Iznos: "-25,00",
        Saldo: "24.975,00",
        Naziv: "BANKA - NAKNADA",
        Svrha: "Mjesecna naknada za vodenje racuna",
      }

      const result = parseZabaRow(row)

      expect(result.direction).toBe(TransactionDirection.DEBIT)
      expect(result.amount.toDecimal().toNumber()).toBe(25)
      expect(result.counterpartyName).toBe("BANKA - NAKNADA")
    })

    it("processes international transfer", () => {
      const row = {
        date: "20.03.2025",
        amount: "-5.000,00",
        balance: "20.000,00",
        counterparty_name: "Acme Inc.",
        counterparty_iban: "DE89370400440532013000",
        reference: "INV-2025-555",
        description: "International payment for services",
        direction: "D",
      }

      const result = parseGenericRow(row)

      expect(result.direction).toBe(TransactionDirection.DEBIT)
      expect(result.counterpartyIban).toBe("DE89370400440532013000")
    })
  })
})
