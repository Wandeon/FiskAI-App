import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeSystemStatusSnapshot } from "../system-status/refresh"

// Smoke test: returns headline + counters

describe("system-status refresh", () => {
  it("returns a snapshot shape", async () => {
    const snapshot = await computeSystemStatusSnapshot({
      requestedByUserId: "test",
      timeoutSeconds: 15,
    })
    assert.ok(snapshot.headlineStatus)
    assert.ok(typeof snapshot.criticalCount === "number")
  })
})
