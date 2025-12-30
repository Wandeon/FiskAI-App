import { describe, it } from "node:test"
import assert from "node:assert"
import { validateStatusTransition } from "../e-invoice-status"

describe("E-Invoice status transitions", () => {
  it("prevents invoice finalization after fiscalization failure", () => {
    assert.strictEqual(validateStatusTransition("ERROR", "SENT"), false)
    assert.strictEqual(validateStatusTransition("ERROR", "DELIVERED"), false)
    assert.strictEqual(validateStatusTransition("ERROR", "ACCEPTED"), false)
    assert.strictEqual(validateStatusTransition("ERROR", "ARCHIVED"), false)
  })

  it("allows retrying fiscalization after failure", () => {
    assert.strictEqual(validateStatusTransition("ERROR", "PENDING_FISCALIZATION"), true)
    assert.strictEqual(validateStatusTransition("ERROR", "DRAFT"), true)
  })

  it("blocks finalization while fiscalization is pending", () => {
    assert.strictEqual(validateStatusTransition("PENDING_FISCALIZATION", "SENT"), false)
    assert.strictEqual(validateStatusTransition("PENDING_FISCALIZATION", "ACCEPTED"), false)
  })
})
