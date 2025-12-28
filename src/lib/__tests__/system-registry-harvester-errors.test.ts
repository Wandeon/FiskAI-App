import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { harvestLibs } from "../system-registry/harvesters/harvest-libs"
import { shouldFailRegistryCheck } from "../system-registry/scripts/registry-check-utils"

describe("Harvester error handling", () => {
  it("flags scan-cap overflow in lib harvesting", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-libs-"))
    const libDir = join(root, "src/lib/biglib")
    mkdirSync(libDir, { recursive: true })
    for (let i = 0; i < 200; i++) {
      writeFileSync(join(libDir, `file-${i}.ts`), "export const x = 1", "utf8")
    }

    const result = await harvestLibs(root)
    assert.ok(result.errors.length > 0)
  })

  it("fails registry-check when harvester errors exist", () => {
    const failed = shouldFailRegistryCheck({
      harvesterErrors: [{ path: "x", message: "err", recoverable: false }],
      enforcement: { passed: true, failures: [], warnings: [] },
      failOnWarn: false,
    })
    assert.equal(failed, true)
  })
})
