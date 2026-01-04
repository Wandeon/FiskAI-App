import { describe, it, expect } from "vitest"
import { mkdtempSync } from "fs"
import os from "os"
import path from "path"

import { db, runWithTenant } from "@/lib/db"
import { runWithContext } from "@/lib/context"
import { runWithAuditContext } from "@/lib/audit-context"
import { createRuleVersion } from "@/lib/fiscal-rules/service"
import { createPayout } from "@/lib/payroll/payout-create"

describe("H4: JOPPD XML artifacts are reproducible", () => {
  it("stores a content-addressed artifact with deterministic checksum", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "shatter-r2-"))
    process.env.R2_MOCK_DIR = tmp
    process.env.DETERMINISTIC_MODE = "true"
    process.env.MOCK_FINA_SIGNING = "true"

    const { prepareJoppdSubmission } = await import("@/lib/joppd/joppd-service")

    const user = await db.user.create({
      data: { email: `shatter-joppd-h4-${crypto.randomUUID()}@example.test` },
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

    await db.ruleTable.upsert({
      where: { key: "JOPPD_CODEBOOK" },
      create: { key: "JOPPD_CODEBOOK", name: "JOPPD codebook", description: "Test seed" },
      update: {},
    })

    await createRuleVersion({
      tableKey: "JOPPD_CODEBOOK",
      version: `test-${crypto.randomUUID()}`,
      effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
      data: { year: 2025, lastVerified: "2025-01-01", source: "test", entries: [] },
    })

    const payout = await runWithContext(
      { requestId: `SHATTER-H4-${crypto.randomUUID()}` },
      async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h4_payout" }, async () =>
            createPayout({
              companyId: company.id,
              payoutDate: new Date("2025-03-31T00:00:00.000Z"),
              periodFrom: new Date("2025-03-01T00:00:00.000Z"),
              periodTo: new Date("2025-03-31T00:00:00.000Z"),
              lines: [
                {
                  lineNumber: 1,
                  employeeName: "Director",
                  employeeOib: "12345678903",
                  grossAmount: "1000.00",
                  netAmount: "800.00",
                  taxAmount: "50.00",
                  joppdData: { mio1: "150.00", mio2: "50.00", hzzo: "165.00" },
                },
              ],
            })
          )
        )
    )

    const run = async () =>
      runWithContext({ requestId: `SHATTER-H4-${crypto.randomUUID()}` }, async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h4_joppd" }, async () =>
            prepareJoppdSubmission({
              companyId: company.id,
              payoutId: payout.id,
              credentials: { oib: company.oib } as any,
              retentionYears: 11,
            })
          )
        )
      )

    const first = await run()
    const second = await run()

    expect(first.signedXmlHash).toBeTruthy()
    expect(first.signedXmlHash).toBe(second.signedXmlHash)

    const artifacts = await db.artifact.findMany({
      where: { companyId: company.id, checksum: first.signedXmlHash ?? undefined },
      orderBy: { createdAt: "asc" },
    })

    expect(artifacts.length).toBeGreaterThanOrEqual(2)
    expect(artifacts[0].checksum).toBe(artifacts[1].checksum)
    expect(artifacts[0].inputHash).toBeTruthy()
    expect(artifacts[0].inputHash).toBe(artifacts[1].inputHash)
  })
})
