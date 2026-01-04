import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { runWithContext } from "@/lib/context"
import { persistDepreciationSchedule } from "@/lib/assets/depreciation"

describe("tenant isolation: depreciation schedule persistence", () => {
  it("does not inject companyId into DepreciationSchedule create", async () => {
    const correlationId = `SHATTER-H1-DEPR-${crypto.randomUUID()}`
    const Decimal = Prisma.Decimal

    const user = await db.user.create({
      data: { email: `shatter-depr-${crypto.randomUUID()}@example.test` },
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

    const asset = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_depr_setup" }, async () => {
          return db.fixedAsset.create({
            data: {
              companyId: company.id,
              name: "Test asset",
              category: "EQUIPMENT",
              acquisitionDate: new Date("2026-01-10T00:00:00.000Z"),
              acquisitionCost: new Decimal("2500.00"),
              salvageValue: new Decimal("0.00"),
              usefulLifeMonths: 24,
              depreciationMethod: "STRAIGHT_LINE",
              status: "ACTIVE",
            },
          })
        })
      )
    )

    const schedule = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_depr_schedule" }, async () => {
          return persistDepreciationSchedule(asset, { periodMonths: 1 }, db)
        })
      )
    )

    expect(schedule.assetId).toBe(asset.id)
  })
})
