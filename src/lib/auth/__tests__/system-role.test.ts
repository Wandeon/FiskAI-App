import { describe, it } from "node:test"
import assert from "node:assert"
import {
  canAccessSubdomain,
  getAvailableSubdomains,
  hasMultipleRoles,
  shouldShowRoleSelection,
} from "../system-role"

describe("System Role Tests", () => {
  it("ADMIN can access all subdomains", () => {
    assert.strictEqual(canAccessSubdomain("ADMIN", "admin"), true)
    assert.strictEqual(canAccessSubdomain("ADMIN", "staff"), true)
    assert.strictEqual(canAccessSubdomain("ADMIN", "app"), true)
  })

  it("STAFF can access staff and app", () => {
    assert.strictEqual(canAccessSubdomain("STAFF", "admin"), false)
    assert.strictEqual(canAccessSubdomain("STAFF", "staff"), true)
    assert.strictEqual(canAccessSubdomain("STAFF", "app"), true)
  })

  it("USER can only access app", () => {
    assert.strictEqual(canAccessSubdomain("USER", "admin"), false)
    assert.strictEqual(canAccessSubdomain("USER", "staff"), false)
    assert.strictEqual(canAccessSubdomain("USER", "app"), true)
  })

  it("getAvailableSubdomains returns correct subdomains", () => {
    assert.deepStrictEqual(getAvailableSubdomains("ADMIN"), ["admin", "staff", "app"])
    assert.deepStrictEqual(getAvailableSubdomains("STAFF"), ["staff", "app"])
    assert.deepStrictEqual(getAvailableSubdomains("USER"), ["app"])
  })

  it("hasMultipleRoles works correctly", () => {
    assert.strictEqual(hasMultipleRoles("ADMIN"), true)
    assert.strictEqual(hasMultipleRoles("STAFF"), true)
    assert.strictEqual(hasMultipleRoles("USER"), false)
  })

  it("shouldShowRoleSelection works correctly", async () => {
    assert.strictEqual(await shouldShowRoleSelection("id1", "ADMIN"), true)
    assert.strictEqual(await shouldShowRoleSelection("id2", "STAFF"), true)
    assert.strictEqual(await shouldShowRoleSelection("id3", "USER"), false)
  })
})
