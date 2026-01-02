/**
 * Period Lock Guard Tests
 *
 * Verifies that period lock enforcement works correctly.
 *
 * @module period-locking
 * @since Enterprise Hardening
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  assertPeriodWritable,
  checkPeriodWritable,
  AccountingPeriodLockedError,
} from "../period-lock-guard"
import {
  PERIOD_AFFECTING_ENTITIES,
  isPeriodAffectingModel,
  getEntityConfig,
} from "../period-affecting-entities"

// Mock Prisma client
const mockPrisma = {
  accountingPeriod: {
    findFirst: vi.fn(),
  },
  eInvoice: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  expense: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  journalEntry: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
} as unknown as Parameters<typeof assertPeriodWritable>[0]

describe("Period-Affecting Entities Registry", () => {
  it("should have all expected entities registered", () => {
    expect(PERIOD_AFFECTING_ENTITIES.length).toBe(15)
  })

  it("should correctly identify period-affecting models", () => {
    expect(isPeriodAffectingModel("EInvoice")).toBe(true)
    expect(isPeriodAffectingModel("Expense")).toBe(true)
    expect(isPeriodAffectingModel("JournalEntry")).toBe(true)
    expect(isPeriodAffectingModel("Payout")).toBe(true)
    expect(isPeriodAffectingModel("DepreciationEntry")).toBe(true)
    expect(isPeriodAffectingModel("User")).toBe(false)
    expect(isPeriodAffectingModel("Company")).toBe(false)
  })

  it("should have correct date fields for direct entities", () => {
    const invoice = getEntityConfig("EInvoice")
    expect(invoice?.effectiveDateField).toBe("issueDate")
    expect(invoice?.entityType).toBe("DIRECT")

    const expense = getEntityConfig("Expense")
    expect(expense?.effectiveDateField).toBe("date")

    const journalEntry = getEntityConfig("JournalEntry")
    expect(journalEntry?.effectiveDateField).toBe("entryDate")

    const payout = getEntityConfig("Payout")
    expect(payout?.effectiveDateField).toBe("payoutDate")
  })

  it("should have correct parent references for derived entities", () => {
    const invoiceLine = getEntityConfig("EInvoiceLine")
    expect(invoiceLine?.entityType).toBe("DERIVED")
    expect(invoiceLine?.dateDerivation).toEqual({
      type: "PARENT_FIELD",
      parentModel: "EInvoice",
      foreignKey: "eInvoiceId",
      dateField: "issueDate",
    })

    const journalLine = getEntityConfig("JournalLine")
    expect(journalLine?.entityType).toBe("DERIVED")
    expect(journalLine?.dateDerivation).toEqual({
      type: "PARENT_FIELD",
      parentModel: "JournalEntry",
      foreignKey: "journalEntryId",
      dateField: "entryDate",
    })
  })
})

describe("assertPeriodWritable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should allow operations on non-period-affecting models", async () => {
    await expect(
      assertPeriodWritable(mockPrisma, "User", "create", { email: "test@example.com" })
    ).resolves.not.toThrow()
  })

  it("should allow operations when no locked period exists", async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null)

    await expect(
      assertPeriodWritable(mockPrisma, "EInvoice", "create", {
        companyId: "company-1",
        issueDate: new Date("2024-01-15"),
      })
    ).resolves.not.toThrow()
  })

  it("should block operations when period is locked", async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      id: "period-1",
      status: "LOCKED",
    })

    await expect(
      assertPeriodWritable(mockPrisma, "EInvoice", "create", {
        companyId: "company-1",
        issueDate: new Date("2024-01-15"),
      })
    ).rejects.toThrow(AccountingPeriodLockedError)
  })

  it("should block operations when period is closed", async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      id: "period-1",
      status: "CLOSED",
    })

    await expect(
      assertPeriodWritable(mockPrisma, "Expense", "update", {
        companyId: "company-1",
        date: new Date("2024-01-15"),
      }, { id: "expense-1" })
    ).rejects.toThrow(AccountingPeriodLockedError)
  })
})

describe("checkPeriodWritable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return allowed=true for non-period-affecting models", async () => {
    const result = await checkPeriodWritable(mockPrisma, "User", "create", {})
    expect(result.allowed).toBe(true)
  })

  it("should return allowed=true when period is open", async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null)

    const result = await checkPeriodWritable(mockPrisma, "EInvoice", "create", {
      companyId: "company-1",
      issueDate: new Date("2024-01-15"),
    })

    expect(result.allowed).toBe(true)
  })

  it("should return allowed=false with reason when period is locked", async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
      id: "period-1",
      status: "LOCKED",
    })

    const result = await checkPeriodWritable(mockPrisma, "EInvoice", "create", {
      companyId: "company-1",
      issueDate: new Date("2024-01-15"),
    })

    expect(result.allowed).toBe(false)
    expect(result.periodStatus).toBe("LOCKED")
    expect(result.reason).toContain("locked")
  })
})

describe("AccountingPeriodLockedError", () => {
  it("should have correct error properties", () => {
    const error = new AccountingPeriodLockedError(
      "EInvoice",
      new Date("2024-01-15"),
      "LOCKED"
    )

    expect(error.code).toBe("PERIOD_LOCKED")
    expect(error.model).toBe("EInvoice")
    expect(error.periodStatus).toBe("LOCKED")
    expect(error.message).toContain("2024-01-15")
    expect(error.message).toContain("EInvoice")
  })

  it("should be serializable to JSON", () => {
    const error = new AccountingPeriodLockedError(
      "Expense",
      new Date("2024-06-30"),
      "CLOSED"
    )

    const json = error.toJSON()
    expect(json.code).toBe("PERIOD_LOCKED")
    expect(json.model).toBe("Expense")
    expect(json.periodStatus).toBe("CLOSED")
    expect(json.effectiveDate).toBeDefined()
  })
})
