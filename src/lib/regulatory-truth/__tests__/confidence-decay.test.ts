// src/lib/regulatory-truth/__tests__/confidence-decay.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { calculateConfidenceDecay } from "../utils/confidence-decay"

describe("confidence-decay", () => {
  describe("calculateConfidenceDecay", () => {
    it("returns 0 decay for rules under 3 months old", () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(oneMonthAgo)
      assert.strictEqual(decay, 0)
    })

    it("returns 0.05 decay for rules 3-6 months old", () => {
      const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(fourMonthsAgo)
      assert.strictEqual(decay, 0.05)
    })

    it("returns 0.10 decay for rules 6-12 months old", () => {
      const eightMonthsAgo = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(eightMonthsAgo)
      assert.strictEqual(decay, 0.1)
    })

    it("returns 0.20 decay for rules over 12 months old", () => {
      const fifteenMonthsAgo = new Date(Date.now() - 450 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(fifteenMonthsAgo)
      assert.strictEqual(decay, 0.2)
    })

    it("caps decay at 0.30", () => {
      const threeYearsAgo = new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000)
      const decay = calculateConfidenceDecay(threeYearsAgo)
      assert.strictEqual(decay, 0.3)
    })
  })
})
