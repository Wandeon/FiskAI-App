/**
 * RBAC Permission System Tests
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { roleHasPermission, PERMISSIONS } from "../rbac"
import { Role } from "@prisma/client"

describe("RBAC Permission System", () => {
  describe("roleHasPermission", () => {
    it("should allow OWNER to delete invoices", () => {
      assert.strictEqual(roleHasPermission("OWNER", "invoice:delete"), true)
    })

    it("should allow ADMIN to delete invoices", () => {
      assert.strictEqual(roleHasPermission("ADMIN", "invoice:delete"), true)
    })

    it("should NOT allow MEMBER to delete invoices", () => {
      assert.strictEqual(roleHasPermission("MEMBER", "invoice:delete"), false)
    })

    it("should NOT allow VIEWER to delete invoices", () => {
      assert.strictEqual(roleHasPermission("VIEWER", "invoice:delete"), false)
    })

    it("should NOT allow ACCOUNTANT to delete invoices", () => {
      assert.strictEqual(roleHasPermission("ACCOUNTANT", "invoice:delete"), false)
    })

    it("should allow VIEWER to read invoices", () => {
      assert.strictEqual(roleHasPermission("VIEWER", "invoice:read"), true)
    })

    it("should allow MEMBER to create invoices", () => {
      assert.strictEqual(roleHasPermission("MEMBER", "invoice:create"), true)
    })

    it("should only allow OWNER to manage billing", () => {
      assert.strictEqual(roleHasPermission("OWNER", "billing:manage"), true)
      assert.strictEqual(roleHasPermission("ADMIN", "billing:manage"), false)
      assert.strictEqual(roleHasPermission("MEMBER", "billing:manage"), false)
    })

    it("should only allow OWNER to update user roles", () => {
      assert.strictEqual(roleHasPermission("OWNER", "users:update_role"), true)
      assert.strictEqual(roleHasPermission("ADMIN", "users:update_role"), false)
    })

    it("should allow OWNER and ADMIN to invite users", () => {
      assert.strictEqual(roleHasPermission("OWNER", "users:invite"), true)
      assert.strictEqual(roleHasPermission("ADMIN", "users:invite"), true)
      assert.strictEqual(roleHasPermission("MEMBER", "users:invite"), false)
    })
  })

  describe("Permission Matrix", () => {
    it("should have consistent permissions for all resource types", () => {
      const resources = ["invoice", "expense", "contact", "product"]

      resources.forEach((resource) => {
        assert.ok(`${resource}:create` in PERMISSIONS, `${resource}:create should exist`)
        assert.ok(`${resource}:read` in PERMISSIONS, `${resource}:read should exist`)
        assert.ok(`${resource}:update` in PERMISSIONS, `${resource}:update should exist`)
        assert.ok(`${resource}:delete` in PERMISSIONS, `${resource}:delete should exist`)
      })
    })

    it("should ensure delete permissions are more restrictive than update", () => {
      const resources = ["invoice", "expense", "contact", "product"]

      resources.forEach((resource) => {
        const updateRoles = PERMISSIONS[`${resource}:update` as keyof typeof PERMISSIONS]
        const deleteRoles = PERMISSIONS[`${resource}:delete` as keyof typeof PERMISSIONS]

        // Delete permissions should be a subset of update permissions
        assert.ok(
          deleteRoles.length <= updateRoles.length,
          `${resource}: delete permissions should be less or equal to update permissions`
        )

        // All roles that can delete should also be able to update
        deleteRoles.forEach((role) => {
          assert.ok(
            updateRoles.includes(role as any),
            `${resource}: ${role} can delete but cannot update`
          )
        })
      })
    })

    it("should ensure all roles can read", () => {
      const resources = ["invoice", "expense", "contact", "product"]

      resources.forEach((resource) => {
        const readRoles = PERMISSIONS[`${resource}:read` as keyof typeof PERMISSIONS]

        // All roles should be able to read
        const allRoles: Role[] = ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"]
        allRoles.forEach((role) => {
          assert.ok(
            readRoles.includes(role as any),
            `${resource}: ${role} should have read permission`
          )
        })
      })
    })
  })
})
