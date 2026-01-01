// src/domain/banking/__tests__/ImportDeduplicator.test.ts
import { describe, it, expect } from "vitest"
import { ImportDeduplicator, DuplicateCheckResult } from "../ImportDeduplicator"
import { BankTransaction, TransactionDirection } from "../BankTransaction"
import { Money } from "@/domain/shared"

function createTransaction(
  overrides: {
    externalId?: string
    amount?: Money
    date?: Date
    reference?: string
  } = {}
): BankTransaction {
  return BankTransaction.create({
    externalId: overrides.externalId ?? "ext-default",
    bankAccountId: "account-123",
    date: overrides.date ?? new Date("2025-01-15"),
    amount: overrides.amount ?? Money.fromString("100.00"),
    direction: TransactionDirection.CREDIT,
    balance: Money.fromString("1000.00"),
    reference: overrides.reference,
  })
}

describe("ImportDeduplicator", () => {
  describe("duplicate by externalId", () => {
    it("detects duplicate when externalId matches", () => {
      const existing = createTransaction({ externalId: "bank-tx-123" })
      const candidate = createTransaction({ externalId: "bank-tx-123" })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(true)
      expect(result.existingTransactionId).toBe(existing.id)
      expect(result.reason).toBe("Matching external ID")
    })

    it("externalId match takes priority over content match", () => {
      // Transaction with matching externalId but different content
      const existing = createTransaction({
        externalId: "bank-tx-123",
        amount: Money.fromString("999.99"),
        date: new Date("2024-01-01"),
        reference: "OLD-REF",
      })
      const candidate = createTransaction({
        externalId: "bank-tx-123",
        amount: Money.fromString("100.00"),
        date: new Date("2025-06-15"),
        reference: "NEW-REF",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(true)
      expect(result.reason).toBe("Matching external ID")
    })

    it("returns first matching externalId transaction", () => {
      const existing1 = createTransaction({ externalId: "bank-tx-123" })
      const existing2 = createTransaction({ externalId: "bank-tx-456" })
      const candidate = createTransaction({ externalId: "bank-tx-123" })

      const deduplicator = new ImportDeduplicator([existing1, existing2])
      const result = deduplicator.check(candidate)

      expect(result.existingTransactionId).toBe(existing1.id)
    })
  })

  describe("duplicate by amount+date+reference", () => {
    it("detects duplicate when amount, date, and reference all match", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "old-ext-id",
        amount: Money.fromString("250.50"),
        date,
        reference: "INV-2025-001",
      })
      const candidate = createTransaction({
        externalId: "new-ext-id", // Different externalId
        amount: Money.fromString("250.50"),
        date,
        reference: "INV-2025-001",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(true)
      expect(result.existingTransactionId).toBe(existing.id)
      expect(result.reason).toBe("Matching amount, date, and reference")
    })

    it("matches on same date regardless of time component", () => {
      const existingDate = new Date("2025-01-15T09:00:00Z")
      const candidateDate = new Date("2025-01-15T17:30:00Z")

      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date: existingDate,
        reference: "REF-123",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.00"),
        date: candidateDate,
        reference: "REF-123",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(true)
    })

    it("matches when both references are undefined", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date,
        reference: undefined,
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.00"),
        date,
        reference: undefined,
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(true)
    })
  })

  describe("non-duplicate scenarios", () => {
    it("returns not duplicate when externalId differs and content differs", () => {
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-15"),
        reference: "REF-A",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("200.00"),
        date: new Date("2025-01-16"),
        reference: "REF-B",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
      expect(result.existingTransactionId).toBeUndefined()
      expect(result.reason).toBeUndefined()
    })

    it("handles multiple existing transactions correctly", () => {
      const existing1 = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-15"),
        reference: "REF-1",
      })
      const existing2 = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("200.00"),
        date: new Date("2025-01-16"),
        reference: "REF-2",
      })
      const candidate = createTransaction({
        externalId: "ext-3",
        amount: Money.fromString("300.00"),
        date: new Date("2025-01-17"),
        reference: "REF-3",
      })

      const deduplicator = new ImportDeduplicator([existing1, existing2])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })
  })

  describe("empty existing transactions", () => {
    it("returns not duplicate when no existing transactions", () => {
      const candidate = createTransaction({
        externalId: "ext-123",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-15"),
        reference: "REF-123",
      })

      const deduplicator = new ImportDeduplicator([])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("can check multiple candidates against empty list", () => {
      const deduplicator = new ImportDeduplicator([])

      const result1 = deduplicator.check(createTransaction({ externalId: "ext-1" }))
      const result2 = deduplicator.check(createTransaction({ externalId: "ext-2" }))

      expect(result1.isDuplicate).toBe(false)
      expect(result2.isDuplicate).toBe(false)
    })
  })

  describe("partial matches (not duplicates)", () => {
    it("different amount with same date and reference is not duplicate", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date,
        reference: "REF-123",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.01"), // Slightly different
        date,
        reference: "REF-123",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("different date with same amount and reference is not duplicate", () => {
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-15"),
        reference: "REF-123",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-16"), // Different day
        reference: "REF-123",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("different reference with same amount and date is not duplicate", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date,
        reference: "REF-123",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.00"),
        date,
        reference: "REF-456", // Different reference
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("undefined vs defined reference is not duplicate", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date,
        reference: "REF-123",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.00"),
        date,
        reference: undefined,
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("only amount matching is not duplicate", () => {
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-15"),
        reference: "REF-A",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("100.00"),
        date: new Date("2025-02-20"),
        reference: "REF-B",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("only date matching is not duplicate", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date,
        reference: "REF-A",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("200.00"),
        date,
        reference: "REF-B",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })

    it("only reference matching is not duplicate", () => {
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("100.00"),
        date: new Date("2025-01-15"),
        reference: "REF-SAME",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("200.00"),
        date: new Date("2025-02-20"),
        reference: "REF-SAME",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })
  })

  describe("Money precision", () => {
    it("correctly handles Money comparison for exact amounts", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("0.10"),
        date,
        reference: "REF",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        // Using fromString to ensure exact match (avoiding float issues)
        amount: Money.fromString("0.10"),
        date,
        reference: "REF",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(true)
    })

    it("detects difference even for small amounts", () => {
      const date = new Date("2025-01-15")
      const existing = createTransaction({
        externalId: "ext-1",
        amount: Money.fromString("0.01"),
        date,
        reference: "REF",
      })
      const candidate = createTransaction({
        externalId: "ext-2",
        amount: Money.fromString("0.02"),
        date,
        reference: "REF",
      })

      const deduplicator = new ImportDeduplicator([existing])
      const result = deduplicator.check(candidate)

      expect(result.isDuplicate).toBe(false)
    })
  })
})
