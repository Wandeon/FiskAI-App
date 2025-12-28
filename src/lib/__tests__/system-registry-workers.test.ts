import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { harvestWorkers } from "../system-registry/harvesters/harvest-workers"

describe("Worker harvester", () => {
  it("enumerates all compose services except governed exclusions", async () => {
    const root = mkdtempSync(join(tmpdir(), "registry-workers-"))
    const compose = [
      "services:",
      "  redis:",
      "    image: redis:7",
      "  api-service:",
      "    image: busybox",
      "  worker-foo:",
      "    image: busybox",
    ].join("\n")
    writeFileSync(join(root, "docker-compose.workers.yml"), compose, "utf8")

    const result = await harvestWorkers(root)
    const ids = result.components.map((c) => c.componentId)

    assert.ok(ids.includes("worker-api-service"))
    assert.ok(ids.includes("worker-foo"))
    assert.ok(!ids.includes("worker-redis"))
  })
})
