import { describe, it, expect } from "vitest"
import { mkdtempSync } from "fs"
import os from "os"
import path from "path"

import { db, runWithTenant } from "@/lib/db"
import { runWithAuditContext } from "@/lib/audit-context"
import { runWithContext } from "@/lib/context"

describe("H4: PDV XML artifacts are reproducible", () => {
  it("generates identical checksum for identical inputs", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "shatter-r2-"))
    process.env.R2_MOCK_DIR = tmp
    process.env.DETERMINISTIC_MODE = "true"

    const { generatePdvXmlArtifact, PDV_XML_GENERATOR_VERSION } =
      await import("@/lib/reports/pdv-xml-artifact")

    const user = await db.user.create({
      data: { email: `shatter-pdv-h4-${crypto.randomUUID()}@example.test` },
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

    const dateFrom = new Date("2025-03-01T00:00:00.000Z")
    const dateTo = new Date("2025-03-31T23:59:59.000Z")

    const run = async () =>
      runWithContext({ requestId: `SHATTER-H4-${crypto.randomUUID()}` }, async () =>
        runWithTenant({ companyId: company.id, userId: user.id }, async () =>
          runWithAuditContext({ actorId: user.id, reason: "shatter_h4_pdv_generate" }, async () =>
            generatePdvXmlArtifact({
              companyId: company.id,
              dateFrom,
              dateTo,
              createdById: user.id,
              reason: "shatter_h4_pdv",
            })
          )
        )
      )

    const first = await run()
    const second = await run()

    expect(first.artifact.generatorVersion).toBe(PDV_XML_GENERATOR_VERSION)
    expect(first.artifact.inputHash).toBeTruthy()
    expect(first.artifact.inputHash).toBe(second.artifact.inputHash)
    expect(first.artifact.checksum).toBe(second.artifact.checksum)
  })
})
