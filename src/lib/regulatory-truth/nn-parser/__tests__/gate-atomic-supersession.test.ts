import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"

const PIPELINE_SCRIPT = "scripts/nn-parse-pipeline.ts"

describe("Gate: Atomic Supersession", () => {
  it("ensures parse pipeline uses a transaction and supersession update", () => {
    const content = readFileSync(PIPELINE_SCRIPT, "utf-8")

    expect(content).toContain("$transaction")
    expect(content).toContain("parsedDocument.create")
    expect(content).toContain("provisionNode.create")
    expect(content).toContain("supersededById")
  })
})
