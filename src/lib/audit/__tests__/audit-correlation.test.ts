import { describe, it, expect } from "vitest"

import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { runWithContext } from "@/lib/context"

async function waitForAuditLog(
  where: NonNullable<Parameters<typeof db.auditLog.findFirst>[0]>["where"]
) {
  const started = Date.now()
  while (Date.now() - started < 2000) {
    const log = await db.auditLog.findFirst({
      where,
      orderBy: { timestamp: "desc" },
    })
    if (log) return log
    await new Promise((r) => setTimeout(r, 25))
  }
  return null
}

describe("H2: audit logs include correlationId and before-state", () => {
  it("records UPDATE with before/after and correlationId", async () => {
    const correlationId = `SHATTER-H2-${crypto.randomUUID()}`

    const user = await db.user.create({
      data: {
        email: `shatter-h2-${crypto.randomUUID()}@example.test`,
        name: "Shatter Auditor",
      },
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

    const bankAccount = await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_h2_setup" }, async () => {
          return db.bankAccount.create({
            data: {
              companyId: company.id,
              name: "Main",
              iban: "HR1210010051863000160",
              bankName: "ZABA",
              currency: "EUR",
              currentBalance: 0,
              isDefault: false,
            },
          })
        })
      )
    )

    await runWithContext({ requestId: correlationId }, async () =>
      runWithTenant({ companyId: company.id, userId: user.id }, async () =>
        runWithAuditContext({ actorId: user.id, reason: "shatter_h2_update" }, async () => {
          await db.bankAccount.update({
            where: { id: bankAccount.id },
            data: { name: "Main Updated" },
          })
        })
      )
    )

    const log = await waitForAuditLog({
      companyId: company.id,
      entity: "BankAccount",
      entityId: bankAccount.id,
      action: "UPDATE",
    })
    expect(log).not.toBeNull()

    const changes = (log!.changes ?? {}) as any
    expect(changes.correlationId).toBe(correlationId)
    expect(changes.before?.name).toBe("Main")
    expect(changes.after?.name).toBe("Main Updated")
  })
})
