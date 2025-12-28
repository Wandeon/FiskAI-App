import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  HEADLINE_STATUSES,
  REFRESH_STATUSES,
  REFRESH_QUALITIES,
  EVENT_TYPES,
} from "../system-status/types"

describe("system-status types", () => {
  it("exposes required enums", () => {
    assert.ok(HEADLINE_STATUSES.includes("OK"))
    assert.ok(REFRESH_STATUSES.includes("FAILED"))
    assert.ok(REFRESH_QUALITIES.includes("DEGRADED"))
    assert.ok(EVENT_TYPES.includes("REFRESH_FAILED"))
  })
})
