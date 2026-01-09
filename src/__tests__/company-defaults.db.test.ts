import { describe, it, expect } from "vitest"

import { db } from "@/lib/db"
import { getCurrentCompany, requireCompany } from "@/lib/auth-utils"

describe("H0: CompanyUser default company invariant (DB)", () => {
  it("enforces exactly one default company per user and makes resolution deterministic", async () => {
    const user = await db.user.create({
      data: {
        email: `defaults-${crypto.randomUUID()}@example.test`,
        name: "Default Invariant Tester",
      },
    })

    const companyA = await db.company.create({
      data: {
        name: "Alpha d.o.o.",
        oib: String(Math.floor(Math.random() * 1e11)).padStart(11, "0"),
        legalForm: "DOO",
        email: "alpha@example.test",
        address: "A 1",
        city: "Zagreb",
        postalCode: "10000",
        country: "HR",
      },
    })

    const companyB = await db.company.create({
      data: {
        name: "Beta d.o.o.",
        oib: String(Math.floor(Math.random() * 1e11)).padStart(11, "0"),
        legalForm: "DOO",
        email: "beta@example.test",
        address: "B 1",
        city: "Zagreb",
        postalCode: "10000",
        country: "HR",
      },
    })

    const cuA = await db.companyUser.create({
      data: { userId: user.id, companyId: companyA.id, role: "OWNER", isDefault: true },
    })

    const cuB = await db.companyUser.create({
      data: { userId: user.id, companyId: companyB.id, role: "OWNER", isDefault: false },
    })

    const currentA = await getCurrentCompany(user.id)
    expect(currentA?.id).toBe(companyA.id)

    // Switch default deterministically via updates (no reliance on AsyncLocalStorage)
    await db.$transaction([
      db.companyUser.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
      db.companyUser.update({ where: { id: cuB.id }, data: { isDefault: true } }),
    ])

    const currentB = await getCurrentCompany(user.id)
    expect(currentB?.id).toBe(companyB.id)

    const required = await requireCompany(user.id)
    expect(required.id).toBe(companyB.id)

    // DB enforcement: attempting to set a second default must fail.
    await expect(db.companyUser.update({ where: { id: cuA.id }, data: { isDefault: true } })).rejects
      .toBeTruthy()

    const defaults = await db.companyUser.count({ where: { userId: user.id, isDefault: true } })
    expect(defaults).toBe(1)
  })
})
