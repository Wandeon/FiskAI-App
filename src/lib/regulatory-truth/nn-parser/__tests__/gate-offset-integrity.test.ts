import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { NNParser } from "../index"
import { validateInvariants } from "../invariants"

const FIXTURE_HTML =
  "src/lib/regulatory-truth/nn-parser/__fixtures__/simple-laws/nn-2020-001-001/input.html"

describe("Gate: Offset Integrity", () => {
  it("ensures cleanText offsets match rawText", async () => {
    const html = readFileSync(FIXTURE_HTML, "utf-8")

    const result = await NNParser.parse({
      evidenceId: "fixture",
      contentClass: "HTML",
      artifact: {
        id: "fixture",
        kind: "HTML_RAW",
        content: html,
        contentHash: "fixture",
      },
    })

    const validation = validateInvariants(result.nodes, result.cleanText)
    const hasOffsetViolations = validation.violations.some((v) => v.invariantId === "PARSE-INV-003")

    expect(hasOffsetViolations).toBe(false)

    for (const node of result.nodes) {
      if (!node.rawText) continue
      const extracted = result.cleanText.substring(node.startOffset, node.endOffset)
      expect(extracted).toBe(node.rawText)
    }
  })
})
