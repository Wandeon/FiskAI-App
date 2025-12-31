import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { diffSnapshots } from "../system-status/diff"
import type { SystemStatusSnapshot } from "../system-status/refresh"

// Helper to create snapshot with defaults
function createSnapshot(overrides: Partial<SystemStatusSnapshot> = {}): SystemStatusSnapshot {
  return {
    headlineStatus: "OK",
    refreshQuality: "FULL",
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    observedCount: 100,
    declaredCount: 50,
    newDriftSinceDays: 7,
    lastRefreshStartedAt: new Date(),
    lastRefreshEndedAt: new Date(),
    lastRefreshStatus: "SUCCESS",
    lastRefreshError: null,
    topItems: [],
    ...overrides,
  }
}

describe("system-status diff", () => {
  it("emits NEW_CRITICAL when critical count rises", () => {
    const prev = createSnapshot({ criticalCount: 0 })
    const next = createSnapshot({ criticalCount: 2 })

    const events = diffSnapshots(prev, next)

    assert.ok(events.some((e) => e.eventType === "NEW_CRITICAL"))
    const event = events.find((e) => e.eventType === "NEW_CRITICAL")
    assert.ok(event?.message.includes("2 new CRITICAL"))
  })

  it("emits CRITICAL_RESOLVED when critical count decreases", () => {
    const prev = createSnapshot({ criticalCount: 3 })
    const next = createSnapshot({ criticalCount: 1 })

    const events = diffSnapshots(prev, next)

    assert.ok(events.some((e) => e.eventType === "CRITICAL_RESOLVED"))
    const event = events.find((e) => e.eventType === "CRITICAL_RESOLVED")
    assert.ok(event?.message.includes("2 CRITICAL issue(s) resolved"))
  })

  it("emits NEW_OBSERVED when observed count increases significantly", () => {
    const prev = createSnapshot({ observedCount: 100 })
    const next = createSnapshot({ observedCount: 110 })

    const events = diffSnapshots(prev, next)

    assert.ok(events.some((e) => e.eventType === "NEW_OBSERVED"))
    const event = events.find((e) => e.eventType === "NEW_OBSERVED")
    assert.ok(event?.message.includes("10 new components"))
  })

  it("does not emit NEW_OBSERVED for small increases", () => {
    const prev = createSnapshot({ observedCount: 100 })
    const next = createSnapshot({ observedCount: 103 })

    const events = diffSnapshots(prev, next)

    assert.ok(!events.some((e) => e.eventType === "NEW_OBSERVED"))
  })

  it("emits DECLARED_MISSING when declared count decreases", () => {
    const prev = createSnapshot({ declaredCount: 50 })
    const next = createSnapshot({ declaredCount: 48 })

    const events = diffSnapshots(prev, next)

    assert.ok(events.some((e) => e.eventType === "DECLARED_MISSING"))
    const event = events.find((e) => e.eventType === "DECLARED_MISSING")
    assert.ok(event?.message.includes("2 component(s) removed"))
  })

  it("emits REFRESH_FAILED when refresh status is FAILED", () => {
    const prev = createSnapshot()
    const next = createSnapshot({
      lastRefreshStatus: "FAILED",
      lastRefreshError: "Database connection error",
    })

    const events = diffSnapshots(prev, next)

    assert.ok(events.some((e) => e.eventType === "REFRESH_FAILED"))
    const event = events.find((e) => e.eventType === "REFRESH_FAILED")
    assert.ok(event?.message.includes("Database connection error"))
  })

  it("emits REFRESH_DEGRADED when quality transitions to DEGRADED", () => {
    const prev = createSnapshot({ refreshQuality: "FULL" })
    const next = createSnapshot({ refreshQuality: "DEGRADED" })

    const events = diffSnapshots(prev, next)

    assert.ok(events.some((e) => e.eventType === "REFRESH_DEGRADED"))
  })

  it("handles null previous snapshot (first refresh)", () => {
    const next = createSnapshot({ criticalCount: 2 })

    const events = diffSnapshots(null, next)

    assert.ok(events.some((e) => e.eventType === "NEW_CRITICAL"))
    const event = events.find((e) => e.eventType === "NEW_CRITICAL")
    assert.ok(event?.message.includes("Initial scan"))
  })

  it("returns empty array when nothing changed", () => {
    const prev = createSnapshot()
    const next = createSnapshot()

    const events = diffSnapshots(prev, next)

    assert.equal(events.length, 0)
  })
})
