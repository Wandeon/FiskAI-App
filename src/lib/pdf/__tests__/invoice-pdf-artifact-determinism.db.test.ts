import { describe, it, expect } from "vitest"
import { mkdtempSync } from "fs"
import os from "os"
import path from "path"

import { Prisma } from "@prisma/client"

import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { runWithContext } from "@/lib/context"

describe("H4: invoice PDF artifacts are reproducible", () => {
  it("generates identical checksum for identical inputs", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "shatter-r2-"))
    process.env.R2_MOCK_DIR = tmp
    process.env.DETERMINISTIC_MODE = "true"

    const { generateInvoicePdfArtifact, INVOICE_PDF_GENERATOR_VERSION } =
      await import("@/lib/pdf/generate-invoice-pdf-artifact")

    const user = await db.user.create({
      data: { email: `shatter-h4-${crypto.randomUUID()}@example.test` },
    })
    const company = await db.company.create({
      data: {
        name: "Shatter d.o.o.",
        oib: String(Math.floor(Math.random() * 1e11)).padStart(11, "0"),
        address: "Audit 1",
        city: "Zagreb",
        postalCode: "10000",
        iban: "HR1210010051863000160",
      },
    })

    const buyer = await db.contact.create({
      data: {
        companyId: company.id,
        name: "EU Buyer GmbH",
        type: "CUSTOMER",
        vatNumber: "DE123456789",
        address: "Buyer 1",
        city: "Berlin",
        postalCode: "10115",
        country: "DE",
      },
    })

    const invoice = await runWithContext(
      { requestId: `SHATTER-H4-${crypto.randomUUID()}` },
      async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h4_setup" }, async () => {
            return db.eInvoice.create({
              data: {
                companyId: company.id,
                direction: "OUTBOUND",
                invoiceNumber: `R-1-${crypto.randomUUID()}`,
                issueDate: new Date("2025-01-15T00:00:00.000Z"),
                dueDate: null,
                currency: "EUR",
                buyerId: buyer.id,
                netAmount: new Prisma.Decimal("100.00"),
                vatAmount: new Prisma.Decimal("0.00"),
                totalAmount: new Prisma.Decimal("100.00"),
                includeBarcode: false,
                status: "SENT",
                lines: {
                  create: [
                    {
                      lineNumber: 1,
                      description: "Consulting",
                      quantity: new Prisma.Decimal("1.000"),
                      unit: "HUR",
                      unitPrice: new Prisma.Decimal("100.00"),
                      netAmount: new Prisma.Decimal("100.00"),
                      vatRate: new Prisma.Decimal("0.00"),
                      vatCategory: "AE",
                      vatAmount: new Prisma.Decimal("0.00"),
                    },
                  ],
                },
              },
            })
          })
        )
    )

    const run = async () =>
      runWithContext({ requestId: `SHATTER-H4-${crypto.randomUUID()}` }, async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h4_generate" }, async () => {
            return generateInvoicePdfArtifact({
              companyId: company.id,
              invoiceId: invoice.id,
              createdById: user.id,
              reason: "shatter_h4",
            })
          })
        )
      )

    const first = await run()
    const second = await run()

    expect(first.artifact.generatorVersion).toBe(INVOICE_PDF_GENERATOR_VERSION)
    expect(first.artifact.inputHash).toBeTruthy()
    expect(first.artifact.inputHash).toBe(second.artifact.inputHash)
    expect(first.artifact.checksum).toBe(second.artifact.checksum)
  }, 30000)
})
