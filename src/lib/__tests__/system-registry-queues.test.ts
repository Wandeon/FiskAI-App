import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { harvestQueues } from "../system-registry/harvesters/harvest-queues"

describe("Queue harvester", () => {
  it("detects queues in any .ts file, not just queue-named files", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-queues-"))
    const libDir = join(root, "src/lib")
    mkdirSync(libDir, { recursive: true })
    writeFileSync(join(libDir, "alpha.ts"), "createQueue('alpha')", "utf8")

    const result = await harvestQueues(root)
    assert.ok(result.components.some((c) => c.componentId === "queue-alpha"))
  })

  it("flags new Queue usage outside allowed factory files", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-queues-"))
    const libDir = join(root, "src/lib")
    mkdirSync(libDir, { recursive: true })
    writeFileSync(join(libDir, "beta.ts"), "new Queue('beta')", "utf8")

    const result = await harvestQueues(root)
    assert.ok(result.errors.length > 0)
  })
})
