import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { runWithContext } from "@/lib/context"

describe("H3: issued invoices allow payment status updates", () => {
  it("allows updating paidAmount/paymentStatus on SENT invoice", async () => {
    const correlationId = `SHATTER-H3-INVOICE-PAYMENT-${crypto.randomUUID()}`
    const Decimal = Prisma.Decimal

    const user = await db.user.create({
      data: { email: `shatter-h3-pay-${crypto.randomUUID()}@example.test` },
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
        runWithAuditContext({ actorId: user.id, reason: "shatter_h3_payment_setup" }, async () => {
          return db.eInvoice.create({
            data: {
              companyId: company.id,
              direction: "OUTBOUND",
              invoiceNumber: `R-1-${crypto.randomUUID()}`,
              issueDate: new Date("2025-01-15T00:00:00.000Z"),
              currency: "EUR",
              netAmount: new Decimal("100.00"),
              vatAmount: new Decimal("0.00"),
              totalAmount: new Decimal("100.00"),
              status: "SENT",
              paidAmount: new Decimal("0.00"),
              paymentStatus: "UNPAID",
            },
          })
        })
      )
    )

    const updated = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_h3_payment_update" }, async () => {
          return db.eInvoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: new Decimal("10.00"),
              paymentStatus: "PARTIAL",
            },
          })
        })
      )
    )

    expect(updated.paidAmount.toFixed(2)).toBe("10.00")
    expect(updated.paymentStatus).toBe("PARTIAL")
  })
})
