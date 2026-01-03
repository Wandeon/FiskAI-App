import { describe, it, expect } from "vitest"

import { Prisma } from "@prisma/client"
import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { runWithContext } from "@/lib/context"
import {
  InvoiceImmutabilityError,
  JoppdImmutabilityError,
  AccountingPeriodLockedError,
} from "@/lib/prisma-extensions"

async function waitForAudit(
  where: NonNullable<Parameters<typeof db.auditLog.findFirst>[0]>["where"]
) {
  const started = Date.now()
  while (Date.now() - started < 2000) {
    const log = await db.auditLog.findFirst({ where, orderBy: { timestamp: "desc" } })
    if (log) return log
    await new Promise((r) => setTimeout(r, 25))
  }
  return null
}

describe("H3: immutability enforcement logs blocked attempts", () => {
  it("blocks fiscalized invoice mutation and logs attempt", async () => {
    const correlationId = `SHATTER-H3-INVOICE-${crypto.randomUUID()}`
    const Decimal = Prisma.Decimal

    const user = await db.user.create({
      data: { email: `shatter-h3-${crypto.randomUUID()}@example.test` },
    })
    const company = await db.company.create({
      data: {
        name: "Shatter d.o.o.",
        oib: String(Math.floor(Math.random() * 1e11)).padStart(11, "0"),
        address: "Audit 1",
        city: "Zagreb",
        postalCode: "10000",
      },
    })

    const invoice = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_h3_setup" }, async () => {
          return db.eInvoice.create({
            data: {
              companyId: company.id,
              direction: "OUTBOUND",
              invoiceNumber: `R-1-${Date.now()}`,
              issueDate: new Date("2025-01-15T00:00:00.000Z"),
              currency: "EUR",
              netAmount: new Decimal("100.00"),
              vatAmount: new Decimal("25.00"),
              totalAmount: new Decimal("125.00"),
              status: "FISCALIZED",
              jir: "JIR-TEST",
              zki: "ZKI-TEST",
              fiscalizedAt: new Date("2025-01-15T00:00:00.000Z"),
            },
          })
        })
      )
    )

    const attempt = async () =>
      runWithContext({ requestId: correlationId }, async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h3_attack" }, async () => {
            await db.eInvoice.update({
              where: { id: invoice.id },
              data: { totalAmount: new Decimal("1.00") },
            })
          })
        )
      )

    await expect(attempt()).rejects.toBeInstanceOf(InvoiceImmutabilityError)

    const persisted = await db.eInvoice.findUnique({ where: { id: invoice.id } })
    expect(persisted?.totalAmount.toFixed(2)).toBe("125.00")

    const audit = await waitForAudit({
      companyId: company.id,
      entity: "EInvoice",
      entityId: invoice.id,
      action: "UPDATE",
    })
    expect(audit).not.toBeNull()
    const changes = (audit!.changes ?? {}) as any
    expect(changes.correlationId).toBe(correlationId)
    expect(changes.blocked).toBe(true)
    expect(String(changes.error || "")).toContain("immutable")
  })

  it("blocks signed/submitted JOPPD mutation and logs attempt", async () => {
    const correlationId = `SHATTER-H3-JOPPD-${crypto.randomUUID()}`
    const user = await db.user.create({
      data: { email: `shatter-h3-joppd-${crypto.randomUUID()}@example.test` },
    })
    const company = await db.company.create({
      data: {
        name: "Shatter d.o.o.",
        oib: String(Math.floor(Math.random() * 1e11)).padStart(11, "0"),
        address: "Audit 1",
        city: "Zagreb",
        postalCode: "10000",
      },
    })

    const submission = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_h3_setup_joppd" }, async () => {
          return db.joppdSubmission.create({
            data: {
              companyId: company.id,
              periodYear: 2025,
              periodMonth: 1,
              status: "SUBMITTED",
              signedXmlStorageKey: "mock://joppd.xml",
              signedXmlHash: "deadbeef",
              submittedAt: new Date("2025-02-15T00:00:00.000Z"),
            },
          })
        })
      )
    )

    const attempt = async () =>
      runWithContext({ requestId: correlationId }, async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h3_attack_joppd" }, async () => {
            await db.joppdSubmission.update({
              where: { id: submission.id },
              data: { signedXmlStorageKey: null },
            })
          })
        )
      )

    await expect(attempt()).rejects.toBeInstanceOf(JoppdImmutabilityError)

    const audit = await waitForAudit({
      companyId: company.id,
      entity: "JoppdSubmission",
      entityId: submission.id,
      action: "UPDATE",
    })
    expect(audit).not.toBeNull()
    const changes = (audit!.changes ?? {}) as any
    expect(changes.correlationId).toBe(correlationId)
    expect(changes.blocked).toBe(true)
  })

  it("blocks writes into locked accounting period and logs attempt", async () => {
    const correlationId = `SHATTER-H3-PERIOD-${crypto.randomUUID()}`
    const user = await db.user.create({
      data: { email: `shatter-h3-period-${crypto.randomUUID()}@example.test` },
    })
    const company = await db.company.create({
      data: {
        name: "Shatter d.o.o.",
        oib: String(Math.floor(Math.random() * 1e11)).padStart(11, "0"),
        address: "Audit 1",
        city: "Zagreb",
        postalCode: "10000",
      },
    })

    const category = await db.expenseCategory.create({
      data: {
        companyId: company.id,
        name: "Bankarske usluge",
        code: "BANK_FEES",
        vatDeductibleDefault: true,
        receiptRequired: false,
        isActive: true,
      },
    })

    const expense = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_h3_setup_expense" }, async () => {
          return db.expense.create({
            data: {
              companyId: company.id,
              categoryId: category.id,
              description: "Old",
              date: new Date("2025-01-15T00:00:00.000Z"),
              dueDate: null,
              netAmount: new Prisma.Decimal("10.00"),
              vatAmount: new Prisma.Decimal("2.50"),
              vatRate: new Prisma.Decimal("25.00"),
              totalAmount: new Prisma.Decimal("12.50"),
              currency: "EUR",
              status: "DRAFT",
            },
          })
        })
      )
    )

    await db.accountingPeriod.create({
      data: {
        companyId: company.id,
        fiscalYear: 2025,
        periodNumber: 1,
        periodType: "MONTHLY",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        endDate: new Date("2025-01-31T23:59:59.999Z"),
        status: "LOCKED",
        lockedAt: new Date("2025-02-01T00:00:00.000Z"),
        lockedById: user.id,
        lockReason: "shatter_lock",
      },
    })

    const attempt = async () =>
      runWithContext({ requestId: correlationId }, async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext(
            { actorId: user.id, reason: "shatter_h3_attack_period" },
            async () => {
              await db.expense.update({
                where: { id: expense.id },
                data: { description: "New" },
              })
            }
          )
        )
      )

    await expect(attempt()).rejects.toBeInstanceOf(AccountingPeriodLockedError)

    const audit = await waitForAudit({
      companyId: company.id,
      entity: "Expense",
      entityId: expense.id,
      action: "UPDATE",
    })
    expect(audit).not.toBeNull()
    const changes = (audit!.changes ?? {}) as any
    expect(changes.correlationId).toBe(correlationId)
    expect(changes.blocked).toBe(true)
  })
})
