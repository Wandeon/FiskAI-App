// src/application/banking/__tests__/ImportBankStatement.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  ImportBankStatement,
  ImportBankStatementInput,
  CsvRowParser,
  CsvParseError,
  ParsedRow,
  BankFormat,
} from "../ImportBankStatement"
import {
  BankTransaction,
  BankTransactionRepository,
  TransactionDirection,
  MatchStatus,
} from "@/domain/banking"
import { Money } from "@/domain/shared"

/**
 * Helper to parse Croatian-formatted amount string to Money.
 * Handles format: -1.234,56 or 1.234,56
 */
function parseCroatianAmount(value: string, currency = "EUR"): Money {
  const trimmed = value.trim()
  const normalized = trimmed
    .replace(/\./g, "") // Remove thousands separators
    .replace(",", ".") // Convert decimal comma to dot
  return Money.fromString(normalized, currency)
}

/**
 * Helper to parse Croatian-formatted date string to Date.
 * Handles format: DD.MM.YYYY
 */
function parseCroatianDate(value: string): Date {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) {
    throw new CsvParseError(`Invalid date format: "${value}" (expected DD.MM.YYYY)`, "date", value)
  }
  const [, dayStr, monthStr, yearStr] = match
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10) - 1
  const year = parseInt(yearStr, 10)
  return new Date(year, month, day)
}

/**
 * Create a mock CsvRowParser that parses generic format
 */
function createMockCsvParser(): CsvRowParser {
  return {
    parse(row: Record<string, string>, format: BankFormat): ParsedRow {
      // Handle generic format
      if (format === "generic") {
        const dateValue = row["date"] || row["Date"]
        const amountValue = row["amount"] || row["Amount"]
        const balanceValue = row["balance"] || row["Balance"]

        if (!dateValue) {
          throw new CsvParseError("Missing date column", "date")
        }
        if (!amountValue) {
          throw new CsvParseError("Missing amount column", "amount")
        }

        // Validate amount format
        const normalizedAmount = amountValue.trim().replace(/\./g, "").replace(",", ".")
        if (!/^-?\d+(\.\d+)?$/.test(normalizedAmount)) {
          throw new CsvParseError(`Invalid amount format: "${amountValue}"`, "amount", amountValue)
        }

        const amount = parseCroatianAmount(amountValue)
        const direction = amount.isNegative()
          ? TransactionDirection.DEBIT
          : TransactionDirection.CREDIT
        const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

        const result: ParsedRow = {
          date: parseCroatianDate(dateValue),
          amount: absoluteAmount,
          direction,
        }

        if (balanceValue) {
          result.balance = parseCroatianAmount(balanceValue)
        }
        if (row["counterparty_name"]?.trim()) {
          result.counterpartyName = row["counterparty_name"].trim()
        }
        if (row["reference"]?.trim()) {
          result.reference = row["reference"].trim()
        }
        if (row["description"]?.trim()) {
          result.description = row["description"].trim()
        }
        if (row["externalId"]?.trim()) {
          result.externalId = row["externalId"].trim()
        }

        return result
      }

      // Handle erste format
      if (format === "erste") {
        const dateValue = row["Datum knjizenja"] || row["Datum valute"] || row["Datum"]
        const amountValue = row["Iznos"]
        const balanceValue = row["Stanje"]

        if (!dateValue) {
          throw new CsvParseError("Missing date column", "Datum knjizenja")
        }
        if (!amountValue) {
          throw new CsvParseError("Missing amount column", "Iznos")
        }

        const amount = parseCroatianAmount(amountValue)
        const direction = amount.isNegative()
          ? TransactionDirection.DEBIT
          : TransactionDirection.CREDIT
        const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

        const result: ParsedRow = {
          date: parseCroatianDate(dateValue),
          amount: absoluteAmount,
          direction,
        }

        if (balanceValue) {
          result.balance = parseCroatianAmount(balanceValue)
        }
        if (row["Opis placanja"]?.trim()) {
          result.description = row["Opis placanja"].trim()
        }
        if (row["ID transakcije"]?.trim()) {
          result.externalId = row["ID transakcije"].trim()
        }

        return result
      }

      // Handle pbz format
      if (format === "pbz") {
        const dateValue = row["Datum"]
        const amountValue = row["Iznos"]
        const balanceValue = row["Stanje"]

        if (!dateValue) {
          throw new CsvParseError("Missing date column", "Datum")
        }
        if (!amountValue) {
          throw new CsvParseError("Missing amount column", "Iznos")
        }

        const amount = parseCroatianAmount(amountValue)
        const direction = amount.isNegative()
          ? TransactionDirection.DEBIT
          : TransactionDirection.CREDIT
        const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

        const result: ParsedRow = {
          date: parseCroatianDate(dateValue),
          amount: absoluteAmount,
          direction,
        }

        if (balanceValue) {
          result.balance = parseCroatianAmount(balanceValue)
        }
        if (row["Opis"]?.trim()) {
          result.description = row["Opis"].trim()
        }
        if (row["ID"]?.trim()) {
          result.externalId = row["ID"].trim()
        }

        return result
      }

      throw new CsvParseError(`Unknown bank format: ${format}`)
    },
  }
}

describe("ImportBankStatement", () => {
  let mockRepository: BankTransactionRepository
  let mockCsvParser: CsvRowParser
  let useCase: ImportBankStatement

  beforeEach(() => {
    mockRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByExternalId: vi.fn().mockResolvedValue(null),
      findByBankAccount: vi.fn().mockResolvedValue([]),
      findUnmatched: vi.fn().mockResolvedValue([]),
      findByDateRange: vi.fn().mockResolvedValue([]),
    }
    mockCsvParser = createMockCsvParser()
    useCase = new ImportBankStatement(mockRepository, mockCsvParser)
  })

  describe("successful import", () => {
    it("imports valid rows and returns correct count", async () => {
      // Using Croatian date format (DD.MM.YYYY) and amount format (comma as decimal)
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            description: "Test transaction 1",
            reference: "REF001",
            externalId: "ext-001",
          },
          {
            date: "16.01.2024",
            amount: "-50,00",
            balance: "950,00",
            description: "Test transaction 2",
            reference: "REF002",
            externalId: "ext-002",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(2)
      expect(result.duplicates).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(mockRepository.save).toHaveBeenCalledTimes(2)
    })

    it("parses erste format correctly", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            "Datum knjizenja": "15.01.2024",
            Iznos: "250,00",
            Stanje: "1.250,00",
            "Opis placanja": "Payment received",
            "ID transakcije": "erste-001",
          },
        ],
        format: "erste",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(1)
      expect(result.errors).toHaveLength(0)

      const savedTransaction = (mockRepository.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as BankTransaction
      expect(savedTransaction.direction).toBe(TransactionDirection.CREDIT)
      expect(savedTransaction.amount.toDecimal().toNumber()).toBe(250)
    })

    it("parses pbz format with negative amounts as debits", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            Datum: "16.01.2024",
            Iznos: "-100,50",
            Stanje: "899,50",
            Opis: "Payment sent",
            ID: "pbz-001",
          },
        ],
        format: "pbz",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(1)
      expect(result.errors).toHaveLength(0)

      const savedTransaction = (mockRepository.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as BankTransaction
      expect(savedTransaction.direction).toBe(TransactionDirection.DEBIT)
      expect(savedTransaction.amount.toDecimal().toNumber()).toBe(100.5)
    })
  })

  describe("duplicate handling", () => {
    it("detects duplicates by external ID and skips them", async () => {
      // Setup existing transaction
      const existingTransaction = BankTransaction.reconstitute({
        id: "existing-id",
        externalId: "ext-001",
        bankAccountId: "bank-account-123",
        date: new Date(2024, 0, 15), // Jan 15, 2024
        amount: Money.fromString("100.00"),
        direction: TransactionDirection.CREDIT,
        balance: Money.fromString("1000.00"),
        matchStatus: MatchStatus.UNMATCHED,
        version: 1,
      })

      mockRepository.findByBankAccount = vi.fn().mockResolvedValue([existingTransaction])

      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            externalId: "ext-001", // Same as existing
          },
          {
            date: "16.01.2024",
            amount: "200,00",
            balance: "1200,00",
            externalId: "ext-002", // New
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(1)
      expect(result.duplicates).toBe(1)
      expect(result.errors).toHaveLength(0)
      expect(mockRepository.save).toHaveBeenCalledTimes(1)
    })

    it("detects duplicates by content (amount + date + reference)", async () => {
      const existingTransaction = BankTransaction.reconstitute({
        id: "existing-id",
        externalId: "different-ext-id",
        bankAccountId: "bank-account-123",
        date: new Date(2024, 0, 15), // Jan 15, 2024
        amount: Money.fromString("100.00"),
        direction: TransactionDirection.CREDIT,
        balance: Money.fromString("1000.00"),
        reference: "REF-SAME",
        matchStatus: MatchStatus.UNMATCHED,
        version: 1,
      })

      mockRepository.findByBankAccount = vi.fn().mockResolvedValue([existingTransaction])

      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            reference: "REF-SAME", // Same amount, date, reference
            externalId: "new-ext-id",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(0)
      expect(result.duplicates).toBe(1)
    })
  })

  describe("error handling for invalid rows", () => {
    it("tracks errors for rows with invalid dates", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "invalid-date",
            amount: "100,00",
            balance: "1000,00",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("Row 1")
      expect(result.errors[0]).toContain("date")
    })

    it("tracks errors for rows with invalid amounts", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "not-a-number",
            balance: "1000,00",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("Row 1")
      expect(result.errors[0]).toContain("amount")
    })

    it("tracks errors for rows missing required fields", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            // Missing date and amount
            balance: "1000,00",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(0)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe("partial failures", () => {
    it("continues processing after encountering invalid rows", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            externalId: "ext-001",
          },
          {
            date: "invalid-date", // Invalid
            amount: "50,00",
            balance: "950,00",
          },
          {
            date: "17.01.2024",
            amount: "200,00",
            balance: "1150,00",
            externalId: "ext-003",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("Row 2")
    })

    it("tracks save failures without affecting other rows", async () => {
      let saveCallCount = 0
      mockRepository.save = vi.fn().mockImplementation(async () => {
        saveCallCount++
        if (saveCallCount === 2) {
          throw new Error("Database connection error")
        }
      })

      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            externalId: "ext-001",
          },
          {
            date: "16.01.2024",
            amount: "200,00",
            balance: "1200,00",
            externalId: "ext-002",
          },
          {
            date: "17.01.2024",
            amount: "300,00",
            balance: "1500,00",
            externalId: "ext-003",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain("Row 2")
      expect(result.errors[0]).toContain("Failed to save")
      expect(result.errors[0]).toContain("Database connection error")
    })

    it("handles mixed duplicates, errors, and successful imports", async () => {
      const existingTransaction = BankTransaction.reconstitute({
        id: "existing-id",
        externalId: "ext-duplicate",
        bankAccountId: "bank-account-123",
        date: new Date(2024, 0, 14), // Jan 14, 2024
        amount: Money.fromString("50.00"),
        direction: TransactionDirection.CREDIT,
        balance: Money.fromString("500.00"),
        matchStatus: MatchStatus.UNMATCHED,
        version: 1,
      })

      mockRepository.findByBankAccount = vi.fn().mockResolvedValue([existingTransaction])

      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            externalId: "ext-001",
          },
          {
            date: "invalid", // Error
            amount: "200,00",
            balance: "1200,00",
          },
          {
            date: "14.01.2024",
            amount: "50,00",
            balance: "500,00",
            externalId: "ext-duplicate", // Duplicate
          },
          {
            date: "17.01.2024",
            amount: "300,00",
            balance: "1800,00",
            externalId: "ext-004",
          },
        ],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(2)
      expect(result.duplicates).toBe(1)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe("edge cases", () => {
    it("handles empty rows array", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "bank-account-123",
        rows: [],
        format: "generic",
      }

      const result = await useCase.execute(input)

      expect(result.imported).toBe(0)
      expect(result.duplicates).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it("uses correct bank account ID for all transactions", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "specific-bank-account",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            externalId: "ext-001",
          },
        ],
        format: "generic",
      }

      await useCase.execute(input)

      const savedTransaction = (mockRepository.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as BankTransaction
      expect(savedTransaction.bankAccountId).toBe("specific-bank-account")
    })

    it("loads existing transactions for the correct bank account", async () => {
      const input: ImportBankStatementInput = {
        bankAccountId: "my-bank-account",
        rows: [
          {
            date: "15.01.2024",
            amount: "100,00",
            balance: "1000,00",
            externalId: "ext-001",
          },
        ],
        format: "generic",
      }

      await useCase.execute(input)

      expect(mockRepository.findByBankAccount).toHaveBeenCalledWith("my-bank-account")
    })
  })
})
