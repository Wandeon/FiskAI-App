// src/domain/banking/__tests__/BankTransaction.test.ts
import { describe, it, expect } from "vitest"
import {
  BankTransaction,
  BankTransactionProps,
  TransactionDirection,
  MatchStatus,
} from "../BankTransaction"
import { BankingError } from "../BankingError"
import { Money } from "@/domain/shared"

function createTestTransaction(
  overrides: Partial<Omit<BankTransactionProps, "id" | "matchStatus" | "version">> = {}
): BankTransaction {
  return BankTransaction.create({
    externalId: "ext-123",
    bankAccountId: "account-456",
    date: new Date("2025-01-15"),
    amount: Money.fromString("100.00"),
    direction: TransactionDirection.CREDIT,
    balance: Money.fromString("1000.00"),
    ...overrides,
  })
}

describe("BankTransaction", () => {
  describe("Creation", () => {
    it("creates an unmatched transaction with version 1", () => {
      const tx = createTestTransaction()

      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
      expect(tx.version).toBe(1)
      expect(tx.id).toBeDefined()
      expect(tx.matchedInvoiceId).toBeUndefined()
      expect(tx.matchedExpenseId).toBeUndefined()
    })

    it("generates unique ID for each transaction", () => {
      const tx1 = createTestTransaction()
      const tx2 = createTestTransaction()

      expect(tx1.id).not.toBe(tx2.id)
    })

    it("stores all provided properties", () => {
      const date = new Date("2025-01-15")
      const tx = createTestTransaction({
        externalId: "ext-abc",
        bankAccountId: "acc-xyz",
        date,
        amount: Money.fromString("250.50"),
        direction: TransactionDirection.DEBIT,
        balance: Money.fromString("500.00"),
        counterpartyName: "ACME Corp",
        counterpartyIban: "HR1234567890123456789",
        reference: "INV-2025-001",
        description: "Payment for services",
      })

      expect(tx.externalId).toBe("ext-abc")
      expect(tx.bankAccountId).toBe("acc-xyz")
      expect(tx.date).toBe(date)
      expect(tx.amount.toDecimal().toNumber()).toBe(250.5)
      expect(tx.direction).toBe(TransactionDirection.DEBIT)
      expect(tx.balance.toDecimal().toNumber()).toBe(500)
      expect(tx.counterpartyName).toBe("ACME Corp")
      expect(tx.counterpartyIban).toBe("HR1234567890123456789")
      expect(tx.reference).toBe("INV-2025-001")
      expect(tx.description).toBe("Payment for services")
    })

    it("throws when amount is negative", () => {
      expect(() =>
        createTestTransaction({
          amount: Money.fromString("-100.00"),
        })
      ).toThrow(BankingError)
      expect(() =>
        createTestTransaction({
          amount: Money.fromString("-100.00"),
        })
      ).toThrow("Amount must be positive")
    })
  })

  describe("signedAmount", () => {
    it("returns positive amount for credits", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        direction: TransactionDirection.CREDIT,
      })

      const signed = tx.signedAmount()

      expect(signed.isPositive()).toBe(true)
      expect(signed.toDecimal().toNumber()).toBe(100)
    })

    it("returns negative amount for debits", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        direction: TransactionDirection.DEBIT,
      })

      const signed = tx.signedAmount()

      expect(signed.isNegative()).toBe(true)
      expect(signed.toDecimal().toNumber()).toBe(-100)
    })

    it("preserves currency in signed amount", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00", "USD"),
        direction: TransactionDirection.DEBIT,
      })

      expect(tx.signedAmount().currency).toBe("USD")
    })
  })

  describe("matchToInvoice", () => {
    it("matches unmatched transaction to invoice (manual)", () => {
      const tx = createTestTransaction()

      tx.matchToInvoice("invoice-123", false)

      expect(tx.matchStatus).toBe(MatchStatus.MANUAL_MATCHED)
      expect(tx.matchedInvoiceId).toBe("invoice-123")
      expect(tx.matchedExpenseId).toBeUndefined()
      expect(tx.version).toBe(2)
    })

    it("matches unmatched transaction to invoice (auto)", () => {
      const tx = createTestTransaction()

      tx.matchToInvoice("invoice-456", true)

      expect(tx.matchStatus).toBe(MatchStatus.AUTO_MATCHED)
      expect(tx.matchedInvoiceId).toBe("invoice-456")
    })

    it("throws when matching already matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("invoice-1", false)

      expect(() => tx.matchToInvoice("invoice-2", false)).toThrow(BankingError)
      expect(() => tx.matchToInvoice("invoice-2", false)).toThrow(
        "current status is MANUAL_MATCHED"
      )
    })

    it("throws when matching ignored transaction", () => {
      const tx = createTestTransaction()
      tx.ignore()

      expect(() => tx.matchToInvoice("invoice-1", false)).toThrow(BankingError)
      expect(() => tx.matchToInvoice("invoice-1", false)).toThrow("current status is IGNORED")
    })

    it("throws when invoice ID is empty", () => {
      const tx = createTestTransaction()

      expect(() => tx.matchToInvoice("", false)).toThrow(BankingError)
      expect(() => tx.matchToInvoice("", false)).toThrow("Invoice ID cannot be empty")
    })

    it("throws when invoice ID is whitespace only", () => {
      const tx = createTestTransaction()

      expect(() => tx.matchToInvoice("   ", false)).toThrow(BankingError)
    })
  })

  describe("matchToExpense", () => {
    it("matches unmatched transaction to expense (manual)", () => {
      const tx = createTestTransaction()

      tx.matchToExpense("expense-123", false)

      expect(tx.matchStatus).toBe(MatchStatus.MANUAL_MATCHED)
      expect(tx.matchedExpenseId).toBe("expense-123")
      expect(tx.matchedInvoiceId).toBeUndefined()
      expect(tx.version).toBe(2)
    })

    it("matches unmatched transaction to expense (auto)", () => {
      const tx = createTestTransaction()

      tx.matchToExpense("expense-456", true)

      expect(tx.matchStatus).toBe(MatchStatus.AUTO_MATCHED)
      expect(tx.matchedExpenseId).toBe("expense-456")
    })

    it("throws when matching already matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToExpense("expense-1", false)

      expect(() => tx.matchToExpense("expense-2", false)).toThrow(BankingError)
    })

    it("throws when expense ID is empty", () => {
      const tx = createTestTransaction()

      expect(() => tx.matchToExpense("", false)).toThrow(BankingError)
      expect(() => tx.matchToExpense("", false)).toThrow("Expense ID cannot be empty")
    })
  })

  describe("unmatch", () => {
    it("unmatches matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("invoice-123", false)

      tx.unmatch()

      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
      expect(tx.matchedInvoiceId).toBeUndefined()
      expect(tx.matchedExpenseId).toBeUndefined()
      expect(tx.version).toBe(3)
    })

    it("unmatches expense-matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToExpense("expense-123", true)

      tx.unmatch()

      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
      expect(tx.matchedExpenseId).toBeUndefined()
    })

    it("is idempotent for already unmatched transaction", () => {
      const tx = createTestTransaction()
      const versionBefore = tx.version

      tx.unmatch()

      expect(tx.version).toBe(versionBefore) // No version bump
      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
    })

    it("throws when trying to unmatch ignored transaction", () => {
      const tx = createTestTransaction()
      tx.ignore()

      expect(() => tx.unmatch()).toThrow(BankingError)
      expect(() => tx.unmatch()).toThrow("Cannot unmatch ignored transaction")
    })
  })

  describe("ignore", () => {
    it("ignores unmatched transaction", () => {
      const tx = createTestTransaction()

      tx.ignore()

      expect(tx.matchStatus).toBe(MatchStatus.IGNORED)
      expect(tx.version).toBe(2)
    })

    it("is idempotent for already ignored transaction", () => {
      const tx = createTestTransaction()
      tx.ignore()
      const versionBefore = tx.version

      tx.ignore()

      expect(tx.version).toBe(versionBefore) // No version bump
    })

    it("throws when ignoring matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("invoice-123", false)

      expect(() => tx.ignore()).toThrow(BankingError)
      expect(() => tx.ignore()).toThrow("Cannot ignore matched transaction")
    })
  })

  describe("unignore", () => {
    it("unignores ignored transaction", () => {
      const tx = createTestTransaction()
      tx.ignore()

      tx.unignore()

      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
      expect(tx.version).toBe(3)
    })

    it("is idempotent for non-ignored transaction", () => {
      const tx = createTestTransaction()
      const versionBefore = tx.version

      tx.unignore()

      expect(tx.version).toBe(versionBefore) // No version bump
    })
  })

  describe("isMatched", () => {
    it("returns false for unmatched transaction", () => {
      const tx = createTestTransaction()

      expect(tx.isMatched()).toBe(false)
    })

    it("returns true for auto-matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("invoice-123", true)

      expect(tx.isMatched()).toBe(true)
    })

    it("returns true for manual-matched transaction", () => {
      const tx = createTestTransaction()
      tx.matchToExpense("expense-123", false)

      expect(tx.isMatched()).toBe(true)
    })

    it("returns false for ignored transaction", () => {
      const tx = createTestTransaction()
      tx.ignore()

      expect(tx.isMatched()).toBe(false)
    })
  })

  describe("reconstitute", () => {
    it("reconstitutes transaction from props", () => {
      const props: BankTransactionProps = {
        id: "tx-abc-123",
        externalId: "ext-xyz-456",
        bankAccountId: "acc-789",
        date: new Date("2025-01-20"),
        amount: Money.fromString("500.00"),
        direction: TransactionDirection.DEBIT,
        balance: Money.fromString("1500.00"),
        counterpartyName: "Supplier Ltd",
        counterpartyIban: "HR0987654321098765432",
        reference: "PO-2025-100",
        description: "Monthly subscription",
        matchStatus: MatchStatus.AUTO_MATCHED,
        matchedInvoiceId: "invoice-abc",
        matchedExpenseId: undefined,
        version: 5,
      }

      const tx = BankTransaction.reconstitute(props)

      expect(tx.id).toBe("tx-abc-123")
      expect(tx.externalId).toBe("ext-xyz-456")
      expect(tx.bankAccountId).toBe("acc-789")
      expect(tx.amount.toDecimal().toNumber()).toBe(500)
      expect(tx.direction).toBe(TransactionDirection.DEBIT)
      expect(tx.balance.toDecimal().toNumber()).toBe(1500)
      expect(tx.counterpartyName).toBe("Supplier Ltd")
      expect(tx.counterpartyIban).toBe("HR0987654321098765432")
      expect(tx.reference).toBe("PO-2025-100")
      expect(tx.description).toBe("Monthly subscription")
      expect(tx.matchStatus).toBe(MatchStatus.AUTO_MATCHED)
      expect(tx.matchedInvoiceId).toBe("invoice-abc")
      expect(tx.matchedExpenseId).toBeUndefined()
      expect(tx.version).toBe(5)
    })

    it("reconstituted transaction can continue operations", () => {
      const props: BankTransactionProps = {
        id: "tx-123",
        externalId: "ext-456",
        bankAccountId: "acc-789",
        date: new Date("2025-01-20"),
        amount: Money.fromString("200.00"),
        direction: TransactionDirection.CREDIT,
        balance: Money.fromString("800.00"),
        matchStatus: MatchStatus.MANUAL_MATCHED,
        matchedInvoiceId: "invoice-123",
        version: 3,
      }

      const tx = BankTransaction.reconstitute(props)
      tx.unmatch()

      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
      expect(tx.version).toBe(4)
    })
  })

  describe("Money value object usage", () => {
    it("uses Money for amount - no float operations", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("0.1"),
      })

      // 0.1 + 0.2 should equal 0.3 exactly (not 0.30000000000000004)
      const sum = tx.amount.add(Money.fromString("0.2"))
      expect(sum.equals(Money.fromString("0.3"))).toBe(true)
    })

    it("uses Money for balance - preserves precision", () => {
      const tx = createTestTransaction({
        balance: Money.fromString("1234567.89"),
      })

      expect(tx.balance.toDecimal().toString()).toBe("1234567.89")
    })

    it("handles Croatian kuna amounts correctly", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("1234.56", "EUR"),
        balance: Money.fromString("9876.54", "EUR"),
      })

      expect(tx.amount.currency).toBe("EUR")
      expect(tx.balance.currency).toBe("EUR")
    })
  })

  describe("State transitions", () => {
    it("follows UNMATCHED -> AUTO_MATCHED -> UNMATCHED flow", () => {
      const tx = createTestTransaction()
      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)

      tx.matchToInvoice("inv-1", true)
      expect(tx.matchStatus).toBe(MatchStatus.AUTO_MATCHED)

      tx.unmatch()
      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
    })

    it("follows UNMATCHED -> MANUAL_MATCHED -> UNMATCHED flow", () => {
      const tx = createTestTransaction()

      tx.matchToExpense("exp-1", false)
      expect(tx.matchStatus).toBe(MatchStatus.MANUAL_MATCHED)

      tx.unmatch()
      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
    })

    it("follows UNMATCHED -> IGNORED -> UNMATCHED flow", () => {
      const tx = createTestTransaction()

      tx.ignore()
      expect(tx.matchStatus).toBe(MatchStatus.IGNORED)

      tx.unignore()
      expect(tx.matchStatus).toBe(MatchStatus.UNMATCHED)
    })

    it("can rematch after unmatching", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("inv-1", true)
      tx.unmatch()

      tx.matchToExpense("exp-1", false)

      expect(tx.matchStatus).toBe(MatchStatus.MANUAL_MATCHED)
      expect(tx.matchedExpenseId).toBe("exp-1")
      expect(tx.matchedInvoiceId).toBeUndefined()
    })

    it("can ignore after unmatching", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("inv-1", true)
      tx.unmatch()

      tx.ignore()

      expect(tx.matchStatus).toBe(MatchStatus.IGNORED)
    })
  })

  describe("Version tracking", () => {
    it("starts at version 1", () => {
      const tx = createTestTransaction()
      expect(tx.version).toBe(1)
    })

    it("increments version on matchToInvoice", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("inv-1", false)
      expect(tx.version).toBe(2)
    })

    it("increments version on matchToExpense", () => {
      const tx = createTestTransaction()
      tx.matchToExpense("exp-1", true)
      expect(tx.version).toBe(2)
    })

    it("increments version on unmatch (when actually unmatching)", () => {
      const tx = createTestTransaction()
      tx.matchToInvoice("inv-1", false)
      tx.unmatch()
      expect(tx.version).toBe(3)
    })

    it("increments version on ignore", () => {
      const tx = createTestTransaction()
      tx.ignore()
      expect(tx.version).toBe(2)
    })

    it("increments version on unignore", () => {
      const tx = createTestTransaction()
      tx.ignore()
      tx.unignore()
      expect(tx.version).toBe(3)
    })

    it("tracks complete lifecycle version", () => {
      const tx = createTestTransaction()
      expect(tx.version).toBe(1) // created

      tx.matchToInvoice("inv-1", true)
      expect(tx.version).toBe(2) // matched

      tx.unmatch()
      expect(tx.version).toBe(3) // unmatched

      tx.matchToExpense("exp-1", false)
      expect(tx.version).toBe(4) // rematched

      tx.unmatch()
      expect(tx.version).toBe(5) // unmatched again

      tx.ignore()
      expect(tx.version).toBe(6) // ignored

      tx.unignore()
      expect(tx.version).toBe(7) // unignored
    })
  })
})
