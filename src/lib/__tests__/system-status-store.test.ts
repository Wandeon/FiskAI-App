import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getCurrentSnapshot } from "../system-status/store"

// Minimal test to ensure module exposes expected API

describe("system-status store", () => {
  it("exports getCurrentSnapshot", () => {
    assert.equal(typeof getCurrentSnapshot, "function")
  })
})
