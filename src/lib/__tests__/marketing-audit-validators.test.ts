import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { detectHardcodedValues } from "../marketing-audit/validators/hardcoded-values"
import { detectEnglishLeakage } from "../marketing-audit/validators/language"
import { detectNonTokenColors } from "../marketing-audit/validators/design-tokens"

describe("Marketing audit validators", () => {
  it("detects hardcoded fiscal values", () => {
    const sample = "Prag za PDV je 60.000 EUR u 2024."
    const hits = detectHardcodedValues(sample)

    assert.ok(hits.length >= 2)
    assert.ok(hits.some((hit) => hit.kind === "currency"))
    assert.ok(hits.some((hit) => hit.kind === "year"))
  })

  it("detects english leakage", () => {
    const issues = detectEnglishLeakage("Sign up for our pricing plan")
    assert.ok(issues.length > 0)
  })

  it("detects non-token colors", () => {
    const hits = detectNonTokenColors('className="text-[#ff0000]"')
    assert.ok(hits.length > 0)
  })
})
