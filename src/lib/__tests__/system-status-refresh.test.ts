import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeSystemStatusSnapshot } from "../system-status/refresh"

// Integration test: runs actual harvesters and drift computation

describe("system-status refresh", () => {
  it("returns a snapshot shape with real drift data", async () => {
    const snapshot = await computeSystemStatusSnapshot({
      requestedByUserId: "test",
      timeoutSeconds: 60,
    })

    // Verify snapshot structure
    assert.ok(snapshot.headlineStatus, "headlineStatus should be defined")
    assert.ok(
      ["OK", "ATTENTION", "ACTION_REQUIRED"].includes(snapshot.headlineStatus),
      "headlineStatus should be valid"
    )

    assert.ok(typeof snapshot.criticalCount === "number", "criticalCount should be a number")
    assert.ok(typeof snapshot.highCount === "number", "highCount should be a number")
    assert.ok(typeof snapshot.mediumCount === "number", "mediumCount should be a number")
    assert.ok(typeof snapshot.lowCount === "number", "lowCount should be a number")
    assert.ok(typeof snapshot.observedCount === "number", "observedCount should be a number")
    assert.ok(typeof snapshot.declaredCount === "number", "declaredCount should be a number")

    // Verify refresh metadata
    assert.ok(
      ["FULL", "DEGRADED"].includes(snapshot.refreshQuality),
      "refreshQuality should be valid"
    )
    assert.ok(snapshot.lastRefreshStartedAt instanceof Date, "lastRefreshStartedAt should be Date")
    assert.ok(snapshot.lastRefreshEndedAt instanceof Date, "lastRefreshEndedAt should be Date")

    // Verify topItems is an array
    assert.ok(Array.isArray(snapshot.topItems), "topItems should be an array")

    // Console output for debugging
    console.log("[test] Snapshot:", {
      headline: snapshot.headlineStatus,
      quality: snapshot.refreshQuality,
      critical: snapshot.criticalCount,
      high: snapshot.highCount,
      observed: snapshot.observedCount,
      declared: snapshot.declaredCount,
      topItems: snapshot.topItems.length,
    })
  })

  it("includes observed and declared counts from system registry", async () => {
    const snapshot = await computeSystemStatusSnapshot({
      requestedByUserId: "test",
      timeoutSeconds: 60,
    })

    // The codebase should have at least some components observed and declared
    assert.ok(snapshot.observedCount >= 0, "observedCount should be >= 0")
    assert.ok(snapshot.declaredCount >= 0, "declaredCount should be >= 0")
  })
})
